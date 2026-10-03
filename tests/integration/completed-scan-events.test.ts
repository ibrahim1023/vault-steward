import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import {
  createReferenceFindingIdentity,
  FINDING_IDENTITY_PROFILE_HASH
} from "../../src/findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../../src/findings/normalize.js";
import { openPluginDatabase, type PluginDatabase } from "../../src/plugin/database.js";

class MemoryBinaryStore {
  private value: Uint8Array | undefined;

  async exists(): Promise<boolean> {
    return this.value !== undefined;
  }

  async readBinary(): Promise<ArrayBuffer> {
    if (!this.value) throw new Error("database file is unavailable");
    return this.value.slice().buffer;
  }

  async writeBinary(_path: string, data: ArrayBuffer): Promise<void> {
    this.value = new Uint8Array(data.slice(0));
  }
}

const DATABASE_PATH = ".obsidian/plugins/vault-steward/vault-steward.sqlite";
const LOCATE = (file: string) => `node_modules/sql.js/dist/${file}`;
const OTHER_PROFILE = "a".repeat(64);

function v2Finding(scanId: string, target: string, sourceRevision = "rev-a"): Finding {
  const promoted: PromotedEvidence = {
    notePath: "A.md",
    locator: "line:1",
    excerpt: `[[${target}]]`,
    role: "reference",
    subjectId: "subject-a",
    sourceRevision
  };
  const finding = normalizeFinding({
    scanId,
    type: "broken-reference",
    severity: "high",
    identity: createReferenceFindingIdentity({
      family: "broken-reference",
      subtype: "missing",
      sourceSubjectId: "subject-a",
      normalizedTarget: `${target}.md`
    }),
    evidence: [promoted],
    availableEvidence: [promoted],
    explanation: "Missing",
    confidence: 1
  });
  if (!finding) throw new Error("expected a promoted v2 finding");
  return finding;
}

function saveScan(
  database: PluginDatabase,
  id: string,
  findings: readonly Finding[],
  options: { identityProfileHash?: string; finishedAt?: string } = {}
): void {
  database.saveCompletedScan({
    id,
    vaultFingerprint: "vault",
    configHash: "config",
    inputHash: id,
    parserVersion: "parser",
    startedAt: "2026-09-29T00:00:00.000Z",
    finishedAt: options.finishedAt ?? "2026-09-29T00:00:01.000Z",
    files: [],
    parseProducts: [],
    findings,
    modelTraces: [],
    identityProfileHash: options.identityProfileHash ?? FINDING_IDENTITY_PROFILE_HASH
  });
}

async function database(createEventId?: () => string) {
  return openPluginDatabase({
    adapter: new MemoryBinaryStore(),
    databasePath: DATABASE_PATH,
    locateFile: LOCATE,
    ...(createEventId ? { createEventId } : {})
  });
}

describe("completed scan comparison and events", () => {
  it("treats the first completed scan as baseline with operational events only", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);

    expect(db.repository.listIntegrityEvents({ category: "operational" })).toMatchObject([
      { kind: "scan-started", scanId: "scan-1" },
      { kind: "scan-completed", scanId: "scan-1" }
    ]);
    expect(db.repository.listIntegrityEvents({ category: "review" })).toHaveLength(0);
    db.close();
  });

  it("emits no review event when evidence revisions are unchanged", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);
    saveScan(db, "scan-2", [v2Finding("scan-2", "Missing")]);

    expect(db.repository.listIntegrityEvents({ category: "review" })).toHaveLength(0);
    db.close();
  });

  it("emits finding-changed when the evidence revision changes", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing", "rev-a")]);
    saveScan(db, "scan-2", [v2Finding("scan-2", "Missing", "rev-b")]);

    const events = db.repository.listIntegrityEvents({ category: "review" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "finding-changed", scanId: "scan-2" });
    db.close();
  });

  it("emits finding-opened and finding-resolved across completed scans", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);
    saveScan(db, "scan-2", [v2Finding("scan-2", "Other")]);
    const resolved = db.repository
      .listIntegrityEvents({ category: "review" })
      .map((event) => event.kind)
      .sort();
    expect(resolved).toEqual(["finding-opened", "finding-resolved"]);

    saveScan(db, "scan-3", []);
    const events = db.repository.listIntegrityEvents({ category: "review" });
    expect(events.filter((event) => event.scanId === "scan-3").map((event) => event.kind)).toEqual([
      "finding-resolved"
    ]);
    db.close();
  });

  it("emits finding-recurred when a key returns after an absent scan", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);
    saveScan(db, "scan-2", [], { finishedAt: "2026-09-29T00:00:02.000Z" });
    saveScan(db, "scan-3", [v2Finding("scan-3", "Missing")], {
      finishedAt: "2026-09-29T00:00:03.000Z"
    });

    const events = db.repository
      .listIntegrityEvents({ category: "review" })
      .filter((event) => event.scanId === "scan-3");
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("finding-recurred");
    db.close();
  });

  it("never compares scans with legacy or unequal identity profiles", async () => {
    const db = await database();
    db.saveCompletedScan({
      id: "scan-legacy",
      vaultFingerprint: "vault",
      configHash: "config",
      inputHash: "legacy",
      parserVersion: "parser",
      startedAt: "2026-09-29T00:00:00.000Z",
      finishedAt: "2026-09-29T00:00:01.000Z",
      files: [],
      parseProducts: [],
      findings: [v2Finding("scan-legacy", "Missing")],
      modelTraces: []
    });
    saveScan(db, "scan-2", [], { identityProfileHash: OTHER_PROFILE });
    saveScan(db, "scan-3", []);

    expect(db.repository.listIntegrityEvents({ category: "review" })).toHaveLength(0);
    db.close();
  });

  it("rolls back findings, occurrences, transitions, and completion on event conflict", async () => {
    let counter = 0;
    const db = await database(() => `event-${counter++}`);
    db.repository.appendIntegrityEvent({
      schemaVersion: 1,
      id: "event-3",
      category: "operational",
      kind: "provider-ready",
      occurredAt: "2026-09-29T00:00:00.000Z",
      safeMetadata: {}
    });
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);

    expect(() => saveScan(db, "scan-2", [v2Finding("scan-2", "Missing", "rev-b")])).toThrow(
      "integrity event id conflict"
    );

    expect(db.repository.listFindingOccurrences({ scanId: "scan-2" })).toHaveLength(0);
    expect(db.repository.listFindings({ scanId: "scan-2" })).toHaveLength(0);
    expect(db.repository.listIntegrityEvents({ category: "review" })).toHaveLength(0);
    expect(db.loadHistory().scans.find((scan) => scan.id === "scan-2")).toMatchObject({
      status: "failed"
    });
    const operational = db.repository
      .listIntegrityEvents({ category: "operational" })
      .filter((event) => event.scanId === "scan-2");
    expect(operational.map((event) => event.kind)).toEqual(["scan-started", "scan-failed"]);
    db.close();
  });

  it("keeps failed scans out of later comparisons", async () => {
    let counter = 0;
    const db = await database(() => `event-${counter++}`);
    db.repository.appendIntegrityEvent({
      schemaVersion: 1,
      id: "event-3",
      category: "operational",
      kind: "provider-ready",
      occurredAt: "2026-09-29T00:00:00.000Z",
      safeMetadata: {}
    });
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);

    expect(() => saveScan(db, "scan-2", [v2Finding("scan-2", "Missing", "rev-b")])).toThrow(
      "integrity event id conflict"
    );

    saveScan(db, "scan-3", []);
    const events = db.repository
      .listIntegrityEvents({ category: "review" })
      .filter((event) => event.scanId === "scan-3");
    expect(events.map((event) => event.kind)).toEqual(["finding-resolved"]);
    db.close();
  });

  it("keeps comparison working when a finding stays unchanged across many scans", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")], {
      finishedAt: "2026-09-29T00:00:01.000Z"
    });
    saveScan(db, "scan-2", [v2Finding("scan-2", "Missing")], {
      finishedAt: "2026-09-29T00:00:02.000Z"
    });
    saveScan(db, "scan-3", [v2Finding("scan-3", "Missing")], {
      finishedAt: "2026-09-29T00:00:03.000Z"
    });
    saveScan(db, "scan-4", [v2Finding("scan-4", "Missing")], {
      finishedAt: "2026-09-29T00:00:04.000Z"
    });

    expect(db.repository.listIntegrityEvents({ category: "review" })).toHaveLength(0);
    expect(db.loadHistory().scans.map((scan) => scan.status)).toEqual([
      "completed",
      "completed",
      "completed",
      "completed"
    ]);
    db.close();
  });

  it("records scan-failed when an interrupted scan recovers on reopen", async () => {
    const store = new MemoryBinaryStore();
    const db = await openPluginDatabase({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE
    });
    db.repository.saveScan({
      id: "scan-interrupted",
      vaultFingerprint: "vault",
      startedAt: "2026-09-29T00:00:00.000Z",
      finishedAt: null,
      status: "running",
      configHash: "config",
      inputHash: "interrupted",
      parserVersion: "parser"
    });
    await db.flush();
    db.close();

    const reopened = await openPluginDatabase({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE
    });
    expect(reopened.repository.listIntegrityEvents()).toEqual([
      expect.objectContaining({
        kind: "scan-failed",
        scanId: "scan-interrupted",
        safeMetadata: { reason: "interrupted" }
      })
    ]);
    reopened.close();
  });

  it("keeps a completed scan truthful when trace pruning fails after commit", async () => {
    const db = await database();
    db.repository.pruneExpiredTraceData = () => {
      throw new Error("prune unavailable");
    };

    expect(() => saveScan(db, "scan-1", [])).toThrow("prune unavailable");

    expect(db.loadHistory().scans.find((scan) => scan.id === "scan-1")).toMatchObject({
      status: "completed"
    });
    expect(
      db.repository
        .listIntegrityEvents({ category: "operational" })
        .filter((event) => event.scanId === "scan-1")
        .map((event) => event.kind)
    ).toEqual(["scan-started", "scan-completed"]);
    db.close();
  });

  it("fails a scan whose finding carries a mismatched scan id", async () => {
    const db = await database();
    expect(() => saveScan(db, "scan-1", [v2Finding("scan-other", "Missing")])).toThrow(
      "does not match"
    );

    expect(db.loadHistory().scans.find((scan) => scan.id === "scan-1")).toMatchObject({
      status: "failed"
    });
    expect(db.repository.listFindingOccurrences({ scanId: "scan-1" })).toHaveLength(0);
    db.close();
  });

  it("loads integrity events for Timeline independently of diagnostic traces", async () => {
    const db = await database();
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);
    expect(db.loadObservability("scan-1").timeline.length).toBeGreaterThan(0);
    expect(db.loadIntegrityTimeline().map((event) => event.kind)).toEqual([
      "scan-started",
      "scan-completed"
    ]);
    db.repository.appendIntegrityEvent({
      schemaVersion: 1,
      id: "provider-event",
      category: "operational",
      kind: "provider-ready",
      occurredAt: "2026-09-29T00:00:03.000Z",
      safeMetadata: {}
    });
    expect(db.loadIntegrityTimeline(3).map((event) => event.kind)).toEqual([
      "scan-started",
      "scan-completed"
    ]);
    db.repository.deleteAllTraceData("2026-09-29T00:00:05.000Z", "trace-delete");
    expect(db.loadIntegrityTimeline().map((event) => event.kind)).toEqual([
      "scan-started",
      "scan-completed",
      "provider-ready"
    ]);
    db.close();
  });

  it("persists scan events across close and reopen", async () => {
    const store = new MemoryBinaryStore();
    const db = await openPluginDatabase({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE
    });
    saveScan(db, "scan-1", [v2Finding("scan-1", "Missing")]);
    await db.flush();
    db.close();

    const reopened = await openPluginDatabase({
      adapter: store,
      databasePath: DATABASE_PATH,
      locateFile: LOCATE
    });
    expect(reopened.repository.listIntegrityEvents()).toMatchObject([
      { kind: "scan-started" },
      { kind: "scan-completed" }
    ]);
    reopened.close();
  });
});
