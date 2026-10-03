import { describe, expect, it } from "vitest";

import {
  createReferenceFindingIdentity,
  FINDING_IDENTITY_PROFILE_HASH
} from "../../src/findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../../src/findings/normalize.js";
import { openPluginDatabase, type PluginDatabase } from "../../src/plugin/database.js";
import {
  loadStewardInbox,
  restoreInboxDisposition,
  reviewInboxOccurrences
} from "../../src/review/dispositions.js";

const NOW = "2026-09-29T00:00:05.000Z";

async function fixture() {
  return openPluginDatabase({
    adapter: {
      exists: async () => false,
      readBinary: async () => new ArrayBuffer(0),
      writeBinary: async () => undefined
    },
    databasePath: "vault-steward.sqlite",
    locateFile: (file) => `node_modules/sql.js/dist/${file}`
  });
}

function finding(
  scanId: string,
  target: string,
  revision: string,
  severity: "critical" | "high" = "high"
) {
  const evidence: PromotedEvidence = {
    notePath: "Home.md",
    locator: "line:1",
    excerpt: `[[${target}]]`,
    role: "reference",
    subjectId: "subject-home",
    sourceRevision: revision
  };
  const promoted = normalizeFinding({
    scanId,
    type: "broken-reference",
    severity,
    identity: createReferenceFindingIdentity({
      family: "broken-reference",
      subtype: "missing",
      sourceSubjectId: "subject-home",
      normalizedTarget: `${target}.md`
    }),
    evidence: [evidence],
    availableEvidence: [evidence],
    explanation: "Missing target",
    confidence: 1
  });
  if (!promoted || promoted.schemaVersion !== 2) throw new Error("expected v2 finding");
  return promoted;
}

function save(db: PluginDatabase, scanId: string, findings: ReturnType<typeof finding>[]) {
  db.saveCompletedScan({
    id: scanId,
    vaultFingerprint: "vault",
    configHash: "config",
    inputHash: scanId,
    parserVersion: "parser",
    startedAt: "2026-09-29T00:00:00.000Z",
    finishedAt: `2026-09-29T00:00:0${scanId.slice(-1)}.000Z`,
    files: [],
    parseProducts: [],
    findings,
    modelTraces: [],
    identityProfileHash: FINDING_IDENTITY_PROFILE_HASH
  });
}

describe("Steward Inbox dispositions", () => {
  it("restores the pre-action database when persisting an Inbox decision fails", async () => {
    let bytes: Uint8Array | undefined;
    let failWrites = false;
    const db = await openPluginDatabase({
      adapter: {
        exists: async () => bytes !== undefined,
        readBinary: async () => bytes!.slice().buffer,
        writeBinary: async (_path, value) => {
          if (failWrites) throw new Error("disk unavailable");
          bytes = new Uint8Array(value.slice(0));
        }
      },
      databasePath: "vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    const current = finding("scan-1", "Missing", "r1");
    save(db, "scan-1", [current]);
    await db.flush();
    failWrites = true;
    await expect(
      db.saveInboxReview({
        occurrenceIds: [current.occurrenceId],
        kind: "ignored",
        createdAt: NOW
      })
    ).rejects.toThrow("disk unavailable");
    expect(loadStewardInbox(db.repository, NOW).items[0]?.disposition).toBeNull();
    expect(db.repository.listIntegrityEvents({ category: "review" })).toEqual([]);
    failWrites = false;
    await db.saveInboxReview({
      occurrenceIds: [current.occurrenceId],
      kind: "ignored",
      createdAt: NOW
    });
    expect(loadStewardInbox(db.repository, NOW).items[0]?.disposition?.kind).toBe("ignored");
    failWrites = true;
    await expect(
      db.restoreInboxReview({
        occurrenceId: current.occurrenceId,
        createdAt: "2026-09-29T00:00:06.000Z"
      })
    ).rejects.toThrow("disk unavailable");
    expect(
      loadStewardInbox(db.repository, "2026-09-29T00:00:07.000Z").items[0]?.disposition?.kind
    ).toBe("ignored");
    expect(
      db.repository.listIntegrityEvents({ category: "review" }).map((event) => event.kind)
    ).toEqual(["disposition-ignored"]);
    db.close();
  });

  it("persists an acknowledged occurrence with an append-only event, without changing finding status", async () => {
    const db = await fixture();
    const critical = finding("scan-1", "Missing", "r1", "critical");
    save(db, "scan-1", [critical]);
    const before = loadStewardInbox(db.repository, NOW);
    expect(before.items.map((item) => item.finding.id)).toEqual([critical.id]);
    expect(before.criticalCount).toBe(1);
    const ids = iterIds();
    reviewInboxOccurrences(
      db.repository,
      {
        occurrenceIds: [critical.occurrenceId],
        kind: "acknowledged",
        createdAt: NOW
      },
      ids
    );
    const after = loadStewardInbox(db.repository, NOW);
    expect(after.items[0]?.disposition?.kind).toBe("acknowledged");
    expect(after.criticalCount).toBe(1);
    expect(after.items[0]?.finding.status).toBe("open");
    expect(db.repository.listIntegrityEvents({ category: "review" })).toEqual([
      expect.objectContaining({
        kind: "disposition-acknowledged",
        stableKey: critical.stableKey,
        occurrenceId: critical.occurrenceId,
        safeMetadata: {}
      })
    ]);
    db.close();
  });

  it("expires a dated snooze and wakes when evidence changes, without hiding critical issues", async () => {
    const db = await fixture();
    const first = finding("scan-1", "Missing", "r1", "critical");
    save(db, "scan-1", [first]);
    reviewInboxOccurrences(
      db.repository,
      {
        occurrenceIds: [first.occurrenceId],
        kind: "snoozed",
        createdAt: NOW,
        untilAt: "2026-09-30T00:00:00.000Z"
      },
      iterIds()
    );
    expect(
      loadStewardInbox(db.repository, "2026-09-29T12:00:00.000Z").items[0]?.disposition?.kind
    ).toBe("snoozed");
    expect(
      loadStewardInbox(db.repository, "2026-09-30T00:00:00.000Z").items[0]?.disposition
    ).toBeNull();
    const changed = finding("scan-2", "Missing", "r2", "critical");
    save(db, "scan-2", [changed]);
    const inbox = loadStewardInbox(db.repository, "2026-09-29T12:00:00.000Z");
    expect(inbox.items[0]?.disposition).toBeNull();
    expect(inbox.criticalCount).toBe(1);
    expect(
      db.repository.listIntegrityEvents({ category: "review" }).map((event) => event.kind)
    ).toContain("disposition-snoozed");
    db.close();
  });

  it("rejects a dated snooze that has already ended", async () => {
    const db = await fixture();
    const current = finding("scan-1", "Missing", "r1");
    save(db, "scan-1", [current]);
    expect(() =>
      reviewInboxOccurrences(db.repository, {
        occurrenceIds: [current.occurrenceId],
        kind: "snoozed",
        createdAt: NOW,
        untilAt: "2026-09-29T00:00:04.000Z"
      })
    ).toThrow("future");
    expect(loadStewardInbox(db.repository, NOW).items[0]?.disposition).toBeNull();
    db.close();
  });

  it("rolls back every selected disposition when a later event cannot append", async () => {
    const db = await fixture();
    const first = finding("scan-1", "First", "r1");
    const second = finding("scan-1", "Second", "r1");
    save(db, "scan-1", [first, second]);
    db.repository.appendIntegrityEvent({
      schemaVersion: 1,
      id: "conflict",
      category: "operational",
      kind: "provider-ready",
      occurredAt: NOW,
      safeMetadata: {}
    });
    const ids = ["disposition-1", "event-1", "disposition-2", "conflict"];
    expect(() =>
      reviewInboxOccurrences(
        db.repository,
        {
          occurrenceIds: [first.occurrenceId, second.occurrenceId],
          kind: "expected",
          createdAt: NOW
        },
        () => ids.shift()!
      )
    ).toThrow("integrity event id conflict");
    expect(
      loadStewardInbox(db.repository, NOW).items.every((item) => item.disposition === null)
    ).toBe(true);
    expect(db.repository.listIntegrityEvents({ category: "review" })).toEqual([]);
    db.close();
  });

  it("does not revive an older acknowledgement when a newer snooze expires", async () => {
    const db = await fixture();
    const current = finding("scan-1", "Missing", "r1");
    save(db, "scan-1", [current]);
    let nextId = 0;
    const createId = () => `serial-${++nextId}`;
    reviewInboxOccurrences(
      db.repository,
      {
        occurrenceIds: [current.occurrenceId],
        kind: "acknowledged",
        createdAt: NOW
      },
      createId
    );
    reviewInboxOccurrences(
      db.repository,
      {
        occurrenceIds: [current.occurrenceId],
        kind: "snoozed",
        createdAt: "2026-09-29T00:00:06.000Z",
        untilAt: "2026-09-29T00:00:07.000Z"
      },
      createId
    );
    expect(
      loadStewardInbox(db.repository, "2026-09-29T00:00:08.000Z").items[0]?.disposition
    ).toBeNull();
    db.close();
  });

  it("restores a disposition with a reversible history event and rejects stale occurrences", async () => {
    const db = await fixture();
    const first = finding("scan-1", "Missing", "r1");
    save(db, "scan-1", [first]);
    reviewInboxOccurrences(
      db.repository,
      {
        occurrenceIds: [first.occurrenceId],
        kind: "ignored",
        createdAt: NOW
      },
      iterIds()
    );
    let nextId = 0;
    restoreInboxDisposition(
      db.repository,
      {
        occurrenceId: first.occurrenceId,
        createdAt: "2026-09-29T00:00:06.000Z"
      },
      () => `restore-${++nextId}`
    );
    expect(
      loadStewardInbox(db.repository, "2026-09-29T00:00:07.000Z").items[0]?.disposition
    ).toBeNull();
    expect(
      db.repository.listIntegrityEvents({ category: "review" }).map((event) => event.kind)
    ).toEqual(["disposition-ignored", "disposition-restored"]);
    const changed = finding("scan-2", "Missing", "r2");
    save(db, "scan-2", [changed]);
    expect(() =>
      reviewInboxOccurrences(db.repository, {
        occurrenceIds: [first.occurrenceId],
        kind: "expected",
        createdAt: "2026-09-29T00:00:08.000Z"
      })
    ).toThrow("no longer current");
    db.close();
  });
});

function iterIds() {
  let value = 0;
  return () => `disposition-test-${++value}`;
}
