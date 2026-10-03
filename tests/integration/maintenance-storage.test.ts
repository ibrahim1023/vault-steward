import { createHash } from "node:crypto";

import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import {
  createEvidenceRevisionKey,
  createFindingIdentity,
  createFindingOccurrence,
  type FindingIdentityInput
} from "../../src/contracts/index.js";
import type { NewIntegrityEvent } from "../../src/contracts/integrity-event.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import {
  VaultStewardRepository,
  type StoredFindingIdentity,
  type StoredFindingOccurrence
} from "../../src/storage/repositories.js";

const TIMESTAMP = "2026-09-28T12:00:00.000Z";

async function createRepository() {
  const sql = await initSqlJs({
    locateFile: (file) => `node_modules/sql.js/dist/${file}`
  });
  const database = new sql.Database();
  applyMigrations(database);
  return { database, repository: new VaultStewardRepository(database) };
}

function seedScan(
  repository: VaultStewardRepository,
  id: string,
  status = "completed",
  startedAt = TIMESTAMP,
  finishedAt: string | null = TIMESTAMP
) {
  repository.saveScan({
    id,
    vaultFingerprint: "vault",
    startedAt,
    finishedAt,
    status,
    configHash: "config",
    inputHash: "input",
    parserVersion: "parser"
  });
}

function seedFinding(repository: VaultStewardRepository, id: string, scanId: string) {
  repository.saveFinding({
    id,
    scanId,
    type: "broken-reference",
    severity: "medium",
    status: "open",
    evidenceJson: "[]",
    payloadJson: "{}"
  });
}

function storedIdentity(overrides: Partial<FindingIdentityInput> = {}): StoredFindingIdentity {
  const identity = createFindingIdentity({
    identityVersion: 1,
    family: "broken-reference",
    subtype: "missing-target",
    detectorId: "deterministic",
    detectorVersion: "1",
    subjectIds: ["subject-1"],
    semanticKey: "Home.md#missing",
    ...overrides
  });
  return {
    stableKey: identity.stableKey,
    identityVersion: 1,
    family: identity.family,
    subtype: identity.subtype,
    detectorId: identity.detectorId,
    detectorVersion: identity.detectorVersion,
    policyId: identity.policyId ?? null,
    policyVersion: identity.policyVersion ?? null,
    subjectIds: identity.subjectIds,
    semanticKey: identity.semanticKey
  };
}

function storedOccurrence(
  stableKey: string,
  scanId: string,
  findingId: string
): StoredFindingOccurrence {
  const evidenceRevisionKey = createEvidenceRevisionKey([
    { role: "note", subjectId: "subject-1", locator: "Home.md", sourceRevision: "rev-1" }
  ]);
  const occurrence = createFindingOccurrence({ stableKey, scanId, evidenceRevisionKey, findingId });
  return {
    occurrenceId: occurrence.occurrenceId,
    stableKey,
    findingId,
    scanId,
    evidenceRevisionKey,
    identityVersion: 1
  };
}

function newEvent(overrides: Partial<NewIntegrityEvent> = {}): NewIntegrityEvent {
  return {
    schemaVersion: 1,
    id: "event-1",
    category: "operational",
    kind: "scan-completed",
    occurredAt: TIMESTAMP,
    safeMetadata: { code: "ok" },
    ...overrides
  };
}

function seedDispositionTarget(
  repository: VaultStewardRepository,
  options: { scanId?: string; findingId?: string; sourceRevision?: string } = {}
) {
  const identity = storedIdentity();
  repository.saveFindingIdentity(identity);
  const scanId = options.scanId ?? "scan-1";
  const findingId = options.findingId ?? "finding-1";
  seedScan(repository, scanId);
  seedFinding(repository, findingId, scanId);
  const evidenceRevisionKey = createEvidenceRevisionKey([
    {
      role: "note",
      subjectId: "subject-1",
      locator: "Home.md",
      sourceRevision: options.sourceRevision ?? "rev-1"
    }
  ]);
  const occurrence = createFindingOccurrence({
    stableKey: identity.stableKey,
    scanId,
    evidenceRevisionKey,
    findingId
  });
  repository.saveFindingOccurrence({
    occurrenceId: occurrence.occurrenceId,
    stableKey: identity.stableKey,
    findingId,
    scanId,
    evidenceRevisionKey,
    identityVersion: 1
  });
  return {
    stableKey: identity.stableKey,
    sourceOccurrenceId: occurrence.occurrenceId,
    sourceEvidenceRevisionKey: evidenceRevisionKey
  };
}

function disposition(
  base: ReturnType<typeof seedDispositionTarget>,
  overrides: Record<string, unknown>
) {
  return {
    ...base,
    id: "disp-x",
    kind: "acknowledged" as const,
    reason: null,
    createdAt: TIMESTAMP,
    untilAt: null,
    untilEvidenceChanges: false,
    restoresDispositionId: null,
    ...overrides
  };
}

describe("repository transactions", () => {
  it("rolls back every write when the operation throws", async () => {
    const { repository } = await createRepository();

    expect(() =>
      repository.withTransaction(() => {
        seedScan(repository, "scan-a");
        seedFinding(repository, "finding-a", "scan-a");
        throw new Error("abort");
      })
    ).toThrow("abort");
    expect(repository.listScanHistory(10)).toHaveLength(0);
    expect(repository.listFindings()).toHaveLength(0);
  });

  it("does not support nested transactions", async () => {
    const { repository } = await createRepository();

    expect(() =>
      repository.withTransaction(() => repository.withTransaction(() => "inner"))
    ).toThrow();
  });
});

describe("note subjects", () => {
  it("binds a subject to a path with active history", async () => {
    const { repository } = await createRepository();

    const record = repository.bindNoteSubject({
      subjectId: "subject-1",
      path: "Home.md",
      observedAt: TIMESTAMP
    });
    expect(record).toEqual({
      subjectId: "subject-1",
      currentPath: "Home.md",
      createdAt: TIMESTAMP,
      deletedAt: null
    });
    expect(repository.findNoteSubjectByPath("Home.md")).toEqual(record);
    expect(repository.listNotePathHistory("subject-1")).toEqual([
      {
        subjectId: "subject-1",
        path: "Home.md",
        observedAt: TIMESTAMP,
        retiredAt: null
      }
    ]);
  });

  it("rejects binding an active subject or path", async () => {
    const { repository } = await createRepository();
    repository.bindNoteSubject({
      subjectId: "subject-1",
      path: "Home.md",
      observedAt: TIMESTAMP
    });

    expect(() =>
      repository.bindNoteSubject({
        subjectId: "subject-1",
        path: "Other.md",
        observedAt: TIMESTAMP
      })
    ).toThrow();
    expect(() =>
      repository.bindNoteSubject({
        subjectId: "subject-2",
        path: "Home.md",
        observedAt: TIMESTAMP
      })
    ).toThrow();
  });

  it("rejects malformed binding input", async () => {
    const { repository } = await createRepository();

    expect(() =>
      repository.bindNoteSubject({ subjectId: "s", path: "/abs.md", observedAt: TIMESTAMP })
    ).toThrow();
    expect(() =>
      repository.bindNoteSubject({
        subjectId: "s",
        path: "../escape.md",
        observedAt: TIMESTAMP
      })
    ).toThrow();
    expect(() =>
      repository.bindNoteSubject({ subjectId: "s", path: "Home.md", observedAt: "now" })
    ).toThrow();
  });

  it("renames a subject transactionally and retires the old path", async () => {
    const { repository } = await createRepository();
    repository.bindNoteSubject({
      subjectId: "subject-1",
      path: "Home.md",
      observedAt: TIMESTAMP
    });
    repository.bindNoteSubject({
      subjectId: "subject-2",
      path: "Other.md",
      observedAt: TIMESTAMP
    });
    const renamedAt = "2026-09-28T13:00:00.000Z";

    const record = repository.renameNoteSubject({
      subjectId: "subject-1",
      oldPath: "Home.md",
      newPath: "Renamed.md",
      observedAt: renamedAt
    });
    expect(record.currentPath).toBe("Renamed.md");
    expect(repository.findNoteSubjectByPath("Home.md")).toBeNull();
    expect(repository.findNoteSubjectByPath("Renamed.md")?.subjectId).toBe("subject-1");
    expect(repository.listNotePathHistory("subject-1")).toEqual([
      {
        subjectId: "subject-1",
        path: "Home.md",
        observedAt: TIMESTAMP,
        retiredAt: renamedAt
      },
      {
        subjectId: "subject-1",
        path: "Renamed.md",
        observedAt: renamedAt,
        retiredAt: null
      }
    ]);

    expect(() =>
      repository.renameNoteSubject({
        subjectId: "subject-1",
        oldPath: "Home.md",
        newPath: "Again.md",
        observedAt: renamedAt
      })
    ).toThrow();
    expect(() =>
      repository.renameNoteSubject({
        subjectId: "subject-1",
        oldPath: "Renamed.md",
        newPath: "Other.md",
        observedAt: renamedAt
      })
    ).toThrow();
    expect(() =>
      repository.renameNoteSubject({
        subjectId: "missing",
        oldPath: "Home.md",
        newPath: "Again.md",
        observedAt: renamedAt
      })
    ).toThrow();
  });

  it("deletes a subject and requires a different subject to reuse the path", async () => {
    const { repository } = await createRepository();
    repository.bindNoteSubject({
      subjectId: "subject-1",
      path: "Home.md",
      observedAt: TIMESTAMP
    });
    const deletedAt = "2026-09-28T14:00:00.000Z";

    const record = repository.deleteNoteSubject({
      subjectId: "subject-1",
      path: "Home.md",
      deletedAt
    });
    expect(record).toEqual({
      subjectId: "subject-1",
      currentPath: null,
      createdAt: TIMESTAMP,
      deletedAt
    });
    expect(repository.findNoteSubjectByPath("Home.md")).toBeNull();
    expect(repository.listNotePathHistory("subject-1")).toEqual([
      {
        subjectId: "subject-1",
        path: "Home.md",
        observedAt: TIMESTAMP,
        retiredAt: deletedAt
      }
    ]);

    expect(() =>
      repository.deleteNoteSubject({
        subjectId: "subject-1",
        path: "Home.md",
        deletedAt
      })
    ).toThrow();
    expect(() =>
      repository.bindNoteSubject({
        subjectId: "subject-1",
        path: "New.md",
        observedAt: deletedAt
      })
    ).toThrow();

    const rebound = repository.bindNoteSubject({
      subjectId: "subject-2",
      path: "Home.md",
      observedAt: deletedAt
    });
    expect(rebound.subjectId).toBe("subject-2");
  });
});

describe("finding identities and occurrences", () => {
  it("persists a v1 identity and rejects mismatched duplicates", async () => {
    const { repository } = await createRepository();
    const identity = storedIdentity();

    repository.saveFindingIdentity(identity);
    expect(repository.listFindingIdentities()).toEqual([identity]);

    repository.saveFindingIdentity(identity);
    expect(repository.listFindingIdentities()).toHaveLength(1);

    expect(() =>
      repository.saveFindingIdentity({ ...identity, semanticKey: "different" })
    ).toThrow();
    expect(() => repository.saveFindingIdentity({ ...identity, policyId: "policy-1" })).toThrow();
  });

  it("rejects invalid and legacy-version identities through the public API", async () => {
    const { repository } = await createRepository();
    const identity = storedIdentity();

    expect(() =>
      repository.saveFindingIdentity({ ...identity, stableKey: "finding:v1:not-a-hash" })
    ).toThrow();
    expect(() => repository.saveFindingIdentity({ ...identity, identityVersion: 0 })).toThrow();
    expect(() => repository.saveFindingIdentity({ ...identity, family: "not-a-family" })).toThrow();
  });

  it("fails closed when a stored v1 identity no longer validates", async () => {
    const { database, repository } = await createRepository();
    repository.saveFindingIdentity(storedIdentity());
    database.run("UPDATE finding_identities SET semantic_key = 'tampered'");

    expect(() => repository.listFindingIdentities()).toThrow();
  });

  it("persists occurrences bound to identity, scan, and finding", async () => {
    const { repository } = await createRepository();
    const identity = storedIdentity();
    repository.saveFindingIdentity(identity);
    seedScan(repository, "scan-1");
    seedFinding(repository, "finding-1", "scan-1");
    const occurrence = storedOccurrence(identity.stableKey, "scan-1", "finding-1");

    repository.saveFindingOccurrence(occurrence);
    expect(repository.listFindingOccurrences()).toEqual([occurrence]);
    expect(repository.listFindingOccurrences({ scanId: "scan-1" })).toEqual([occurrence]);
    expect(repository.listFindingOccurrences({ scanId: "scan-2" })).toEqual([]);
    expect(repository.listFindingOccurrences({ stableKey: identity.stableKey })).toEqual([
      occurrence
    ]);

    repository.saveFindingOccurrence(occurrence);
    expect(repository.listFindingOccurrences()).toHaveLength(1);
  });

  it("rejects mismatched or legacy occurrences", async () => {
    const { repository } = await createRepository();
    const identity = storedIdentity();
    repository.saveFindingIdentity(identity);
    seedScan(repository, "scan-1");
    seedScan(repository, "scan-2");
    seedFinding(repository, "finding-1", "scan-1");
    seedFinding(repository, "finding-2", "scan-2");
    const occurrence = storedOccurrence(identity.stableKey, "scan-1", "finding-1");
    repository.saveFindingOccurrence(occurrence);

    expect(() =>
      repository.saveFindingOccurrence({ ...occurrence, findingId: "finding-2" })
    ).toThrow();
    expect(() => repository.saveFindingOccurrence({ ...occurrence, identityVersion: 0 })).toThrow();
  });

  it("rejects unsupported identity versions and malformed v0 identities", async () => {
    const { database, repository } = await createRepository();
    database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key) VALUES ('finding:v2:abc', 2, 'broken-reference', 'missing-target', 'deterministic', '1', NULL, NULL, '[]', 'key')"
    );
    expect(() => repository.listFindingIdentities()).toThrow();

    const second = await createRepository();
    second.database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key) VALUES ('finding:v0:not-hex', 0, 'broken-reference', 'legacy', 'legacy-backfill', '0', NULL, NULL, '[]', 'finding-1')"
    );
    expect(() => second.repository.listFindingIdentities()).toThrow();

    const third = await createRepository();
    third.database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key) VALUES ('finding:v0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 0, 'broken-reference', 'custom', 'legacy-backfill', '0', NULL, NULL, '[]', 'finding-1')"
    );
    expect(() => third.repository.listFindingIdentities()).toThrow();
  });

  it("rejects unsupported occurrence versions and malformed v0 occurrences", async () => {
    const { database, repository } = await createRepository();
    seedScan(repository, "scan-1");
    seedFinding(repository, "finding-1", "scan-1");
    database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, subject_ids_json, semantic_key) VALUES ('finding:v0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 0, 'broken-reference', 'legacy', 'legacy-backfill', '0', '[]', 'finding-1')"
    );
    database.run(
      "INSERT INTO finding_occurrences (occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version) VALUES ('occurrence:v2:abc', 'finding:v0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'finding-1', 'scan-1', 'evidence:v0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 2)"
    );
    expect(() => repository.listFindingOccurrences()).toThrow();

    const second = await createRepository();
    seedScan(second.repository, "scan-1");
    seedFinding(second.repository, "finding-1", "scan-1");
    second.database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, subject_ids_json, semantic_key) VALUES ('finding:v0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 0, 'broken-reference', 'legacy', 'legacy-backfill', '0', '[]', 'finding-1')"
    );
    second.database.run(
      "INSERT INTO finding_occurrences (occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version) VALUES ('occurrence:v0:not-hex', 'finding:v0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'finding-1', 'scan-1', 'evidence:v0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 0)"
    );
    expect(() => second.repository.listFindingOccurrences()).toThrow();

    const third = await createRepository();
    third.repository.saveFindingIdentity(storedIdentity());
    seedScan(third.repository, "scan-1");
    seedFinding(third.repository, "finding-1", "scan-1");
    third.database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, subject_ids_json, semantic_key) VALUES ('finding:v0:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 1, 'broken-reference', 'legacy', 'legacy-backfill', '0', '[]', 'finding-1')"
    );
    third.database.run(
      "INSERT INTO finding_occurrences (occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version) VALUES ('occurrence:v0:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'finding:v0:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'finding-1', 'scan-1', 'evidence:v0:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 0)"
    );
    expect(() => third.repository.listFindingOccurrences()).toThrow();
  });

  it("rejects a v0 occurrence whose referenced identity shape is malformed", async () => {
    const { database, repository } = await createRepository();
    seedScan(repository, "scan-1");
    seedFinding(repository, "finding-1", "scan-1");
    repository.backfillLegacyFindingOccurrences();
    expect(repository.listFindingOccurrences()).toHaveLength(1);

    database.run("UPDATE finding_identities SET subtype = 'custom'");
    expect(() => repository.listFindingOccurrences()).toThrow();
  });
});

describe("integrity events", () => {
  it("assigns monotonic sequences even for identical timestamps", async () => {
    const { repository } = await createRepository();

    const first = repository.appendIntegrityEvent(newEvent({ id: "event-1" }));
    const second = repository.appendIntegrityEvent(newEvent({ id: "event-2" }));
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(repository.listIntegrityEvents().map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("filters events by category and scan id", async () => {
    const { repository } = await createRepository();
    seedScan(repository, "scan-1");
    repository.appendIntegrityEvent(newEvent({ id: "event-op", scanId: "scan-1" }));
    repository.appendIntegrityEvent(
      newEvent({ id: "event-audit", category: "audit", kind: "proposal-approved" })
    );

    expect(
      repository.listIntegrityEvents({ category: "operational" }).map((event) => event.id)
    ).toEqual(["event-op"]);
    expect(repository.listIntegrityEvents({ scanId: "scan-1" })).toHaveLength(1);
    expect(repository.listIntegrityEvents({ scanId: "scan-2" })).toEqual([]);
  });

  it("lists the newest bounded integrity events in monotonic order", async () => {
    const { repository } = await createRepository();
    for (const id of ["event-1", "event-2", "event-3"]) {
      repository.appendIntegrityEvent(newEvent({ id }));
    }
    expect(repository.listIntegrityEvents({ limit: 2 }).map((event) => event.id)).toEqual([
      "event-2",
      "event-3"
    ]);
    expect(
      repository.listIntegrityEvents({ limit: 2, beforeSequence: 3 }).map((event) => event.id)
    ).toEqual(["event-1", "event-2"]);
    expect(() => repository.listIntegrityEvents({ limit: 2, beforeSequence: 0 })).toThrow();
    expect(() => repository.listIntegrityEvents({ limit: 0 })).toThrow();
    expect(() => repository.listIntegrityEvents({ limit: 501 })).toThrow();
  });

  it("fills a bounded page past safe unknown event kinds without losing known history", async () => {
    const { database, repository } = await createRepository();
    repository.appendIntegrityEvent(newEvent({ id: "known-1" }));
    repository.appendIntegrityEvent(newEvent({ id: "known-2" }));
    database.run(
      "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, safe_metadata_json) VALUES ('future', 1, 'operational', 'future-event', '2026-09-28T12:00:00.000Z', '{}')"
    );
    expect(repository.listIntegrityEvents({ limit: 2 }).map((event) => event.id)).toEqual([
      "known-1",
      "known-2"
    ]);
  });

  it("returns the persisted event for an exact duplicate and rejects a mismatch", async () => {
    const { repository } = await createRepository();

    const persisted = repository.appendIntegrityEvent(
      newEvent({ id: "event-1", safeMetadata: { code: "ok", count: 2 } })
    );
    const duplicate = repository.appendIntegrityEvent(
      newEvent({ id: "event-1", safeMetadata: { count: 2, code: "ok" } })
    );
    expect(duplicate).toEqual(persisted);
    expect(repository.listIntegrityEvents()).toHaveLength(1);

    expect(() =>
      repository.appendIntegrityEvent(
        newEvent({ id: "event-1", occurredAt: "2026-09-28T13:00:00.000Z" })
      )
    ).toThrow();
    expect(() =>
      repository.appendIntegrityEvent(
        newEvent({ id: "event-1", safeMetadata: { code: "different" } })
      )
    ).toThrow();
  });

  it("rejects invalid events and unknown canonical references", async () => {
    const { repository } = await createRepository();

    expect(() =>
      repository.appendIntegrityEvent(newEvent({ kind: "proposal-approved" }))
    ).toThrow();
    expect(() => repository.appendIntegrityEvent(newEvent({ scanId: "missing-scan" }))).toThrow();
  });

  it("omits structurally safe events with unknown kinds", async () => {
    const { database, repository } = await createRepository();
    repository.appendIntegrityEvent(newEvent({ id: "known-1" }));
    database.run(
      "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, scan_id, stable_key, occurrence_id, proposal_id, approval_id, safe_metadata_json) VALUES ('future-kind', 1, 'operational', 'future-event', '2026-09-28T12:00:00.000Z', NULL, NULL, NULL, NULL, NULL, '{}')"
    );

    expect(repository.listIntegrityEvents().map((event) => event.id)).toEqual(["known-1"]);
  });

  it("omits structurally safe events with unknown schema versions", async () => {
    const { database, repository } = await createRepository();
    repository.appendIntegrityEvent(newEvent({ id: "known-1" }));
    database.run(
      "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, scan_id, stable_key, occurrence_id, proposal_id, approval_id, safe_metadata_json) VALUES ('future-schema', 2, 'operational', 'scan-completed', '2026-09-28T12:00:00.000Z', NULL, NULL, NULL, NULL, NULL, '{}')"
    );

    expect(repository.listIntegrityEvents().map((event) => event.id)).toEqual(["known-1"]);
  });

  it("still throws for malformed or unsafe stored events", async () => {
    const { database, repository } = await createRepository();
    repository.appendIntegrityEvent(newEvent({ id: "known-1" }));
    database.run(
      "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, safe_metadata_json) VALUES ('bad-json', 1, 'operational', 'scan-completed', '2026-09-28T12:00:00.000Z', 'not-json')"
    );
    expect(() => repository.listIntegrityEvents()).toThrow();

    const second = await createRepository();
    second.repository.appendIntegrityEvent(newEvent({ id: "known-1" }));
    second.database.run(
      "UPDATE integrity_events SET safe_metadata_json = '{}' WHERE id = 'known-1'"
    );
    second.database.run(
      "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, safe_metadata_json) VALUES ('unsafe-schema', 0, 'operational', 'scan-completed', '2026-09-28T12:00:00.000Z', '{}')"
    );
    expect(() => second.repository.listIntegrityEvents()).toThrow();
  });

  it("throws for an unsafe unknown event row with an over-bounded kind", async () => {
    const { database, repository } = await createRepository();
    repository.appendIntegrityEvent(newEvent({ id: "known-1" }));
    database.run(
      `INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, safe_metadata_json) VALUES ('future-long-kind', 1, 'operational', '${"k".repeat(81)}', '2026-09-28T12:00:00.000Z', '{}')`
    );

    expect(() => repository.listIntegrityEvents()).toThrow();
  });

  it("rejects an exact-duplicate append when the stored event is not currently known", async () => {
    const { database, repository } = await createRepository();
    database.run(
      "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, safe_metadata_json) VALUES ('evt-x', 1, 'operational', 'future-event', '2026-09-28T12:00:00.000Z', '{}')"
    );

    expect(() => repository.appendIntegrityEvent(newEvent({ id: "evt-x" }))).toThrow();
  });
});

describe("review dispositions", () => {
  it("returns the newest active disposition for the matching evidence revision", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);
    const second = seedDispositionTarget(repository, {
      scanId: "scan-2",
      findingId: "finding-2",
      sourceRevision: "rev-2"
    });
    repository.appendReviewDisposition({
      ...base,
      id: "disp-1",
      kind: "acknowledged",
      reason: "triage",
      createdAt: TIMESTAMP,
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });
    repository.appendReviewDisposition({
      ...base,
      id: "disp-2",
      kind: "ignored",
      reason: null,
      createdAt: "2026-09-28T13:00:00.000Z",
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });
    repository.appendReviewDisposition({
      ...second,
      id: "disp-other",
      kind: "expected",
      reason: null,
      createdAt: "2026-09-28T14:00:00.000Z",
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });

    const effective = repository.getEffectiveReviewDisposition({
      stableKey: base.stableKey,
      evidenceRevisionKey: base.sourceEvidenceRevisionKey,
      now: "2026-09-29T00:00:00.000Z"
    });
    expect(effective?.id).toBe("disp-2");
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: "ev-missing",
        now: "2026-09-29T00:00:00.000Z"
      })
    ).toBeNull();
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: second.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })?.id
    ).toBe("disp-other");
  });

  it("prefers the later row when dispositions share a timestamp", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);
    repository.appendReviewDisposition({
      ...base,
      id: "disp-early",
      kind: "acknowledged",
      reason: null,
      createdAt: TIMESTAMP,
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });
    repository.appendReviewDisposition({
      ...base,
      id: "disp-late",
      kind: "expected",
      reason: null,
      createdAt: TIMESTAMP,
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });

    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })?.id
    ).toBe("disp-late");
  });

  it("applies dated and evidence-bound snooze semantics", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);
    const snooze = (id: string, untilAt: string | null, untilEvidenceChanges: boolean) =>
      repository.appendReviewDisposition({
        ...base,
        id,
        kind: "snoozed",
        reason: null,
        createdAt: TIMESTAMP,
        untilAt,
        untilEvidenceChanges,
        restoresDispositionId: null
      });

    snooze("disp-future", "2030-01-01T00:00:00.000Z", false);
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })?.id
    ).toBe("disp-future");

    repository.appendReviewDisposition({
      ...base,
      id: "disp-expired",
      kind: "snoozed",
      reason: null,
      createdAt: "2026-09-28T13:00:00.000Z",
      untilAt: "2020-01-01T00:00:00.000Z",
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })
    ).toBeNull();

    repository.appendReviewDisposition({
      ...base,
      id: "disp-evidence",
      kind: "snoozed",
      reason: null,
      createdAt: "2026-09-28T14:00:00.000Z",
      untilAt: null,
      untilEvidenceChanges: true,
      restoresDispositionId: null
    });
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })?.id
    ).toBe("disp-evidence");
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: "ev-changed",
        now: "2026-09-29T00:00:00.000Z"
      })
    ).toBeNull();
  });

  it("validates snooze bounds, kind fields, and restore targets", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);
    const invalid = (overrides: Record<string, unknown>) => disposition(base, overrides);

    expect(() =>
      repository.appendReviewDisposition(
        invalid({
          id: "bad-1",
          kind: "snoozed",
          untilAt: "2030-01-01T00:00:00.000Z",
          untilEvidenceChanges: true
        })
      )
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(invalid({ id: "bad-2", kind: "snoozed" }))
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(
        invalid({ id: "bad-3", untilAt: "2030-01-01T00:00:00.000Z" })
      )
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(invalid({ id: "bad-4", untilEvidenceChanges: true }))
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(invalid({ id: "bad-5", createdAt: "not-a-date" }))
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(
        invalid({ id: "bad-6", kind: "restored", restoresDispositionId: "missing" })
      )
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(invalid({ id: "bad-7", restoresDispositionId: "disp-x" }))
    ).toThrow();
  });

  it("reverses the targeted disposition when restored", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);
    repository.appendReviewDisposition({
      ...base,
      id: "disp-ack",
      kind: "acknowledged",
      reason: null,
      createdAt: TIMESTAMP,
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });
    repository.appendReviewDisposition({
      ...base,
      id: "disp-ignored",
      kind: "ignored",
      reason: null,
      createdAt: "2026-09-28T13:00:00.000Z",
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: null
    });
    repository.appendReviewDisposition({
      ...base,
      id: "disp-restored",
      kind: "restored",
      reason: null,
      createdAt: "2026-09-28T14:00:00.000Z",
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: "disp-ignored"
    });

    expect(() =>
      repository.appendReviewDisposition(
        disposition(base, {
          id: "disp-restored-again",
          kind: "restored",
          restoresDispositionId: "disp-ignored"
        })
      )
    ).toThrow();

    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })?.id
    ).toBe("disp-ack");

    repository.appendReviewDisposition({
      ...base,
      id: "disp-restored-ack",
      kind: "restored",
      reason: null,
      createdAt: "2026-09-28T15:00:00.000Z",
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: "disp-ack"
    });
    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })
    ).toBeNull();
  });

  it("requires an occurrence whose identity and evidence match the disposition", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);

    expect(() =>
      repository.appendReviewDisposition(
        disposition(base, { sourceOccurrenceId: "occurrence:v1:missing" })
      )
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(disposition(base, { stableKey: "stable-other" }))
    ).toThrow();
    expect(() =>
      repository.appendReviewDisposition(
        disposition(base, { sourceEvidenceRevisionKey: "ev-other" })
      )
    ).toThrow();
  });

  it("restores a disposition recorded against an earlier evidence revision", async () => {
    const { repository } = await createRepository();
    const base = seedDispositionTarget(repository);
    const second = seedDispositionTarget(repository, {
      scanId: "scan-2",
      findingId: "finding-2",
      sourceRevision: "rev-2"
    });

    repository.appendReviewDisposition(disposition(base, { id: "disp-v1", kind: "acknowledged" }));
    repository.appendReviewDisposition(
      disposition(second, {
        id: "disp-restore",
        kind: "restored",
        restoresDispositionId: "disp-v1"
      })
    );

    expect(
      repository.getEffectiveReviewDisposition({
        stableKey: base.stableKey,
        evidenceRevisionKey: base.sourceEvidenceRevisionKey,
        now: "2026-09-29T00:00:00.000Z"
      })
    ).toBeNull();
  });
});

describe("integrity retention", () => {
  it("defaults to 180 operational days and accepts bounded updates", async () => {
    const { repository } = await createRepository();

    expect(repository.getIntegrityRetentionSettings()).toEqual({
      operationalDays: 180,
      updatedAt: "2026-09-28T00:00:00.000Z"
    });
    repository.setIntegrityRetentionSettings({
      operationalDays: 30,
      updatedAt: "2026-09-29T00:00:00.000Z"
    });
    expect(repository.getIntegrityRetentionSettings().operationalDays).toBe(30);

    for (const days of [0, 29, 3651, 1.5, Number.NaN]) {
      expect(() =>
        repository.setIntegrityRetentionSettings({
          operationalDays: days,
          updatedAt: TIMESTAMP
        })
      ).toThrow();
    }
    expect(() =>
      repository.setIntegrityRetentionSettings({ operationalDays: 60, updatedAt: "soon" })
    ).toThrow();
  });

  it("prunes old operational events while preserving protected scans and dependencies", async () => {
    const { repository } = await createRepository();
    const baseTime = Date.parse("2026-01-01T00:00:00.000Z");
    for (let index = 0; index <= 51; index += 1) {
      seedScan(
        repository,
        `scan-${String(index).padStart(2, "0")}`,
        "completed",
        TIMESTAMP,
        new Date(baseTime + index * 1_000).toISOString()
      );
    }
    const old = "2026-01-02T00:00:00.000Z";
    repository.appendIntegrityEvent(
      newEvent({ id: "op-oldest", scanId: "scan-00", occurredAt: old })
    );
    repository.appendIntegrityEvent(
      newEvent({ id: "op-shared", scanId: "scan-01", occurredAt: old })
    );
    repository.appendIntegrityEvent(
      newEvent({ id: "op-newest", scanId: "scan-51", occurredAt: old })
    );
    repository.appendIntegrityEvent(newEvent({ id: "op-null", occurredAt: old }));
    repository.appendIntegrityEvent(
      newEvent({ id: "op-recent", scanId: "scan-00", occurredAt: "2026-12-01T00:00:00.000Z" })
    );
    repository.appendIntegrityEvent(
      newEvent({
        id: "audit-shared",
        category: "audit",
        kind: "proposal-approved",
        scanId: "scan-01",
        occurredAt: old
      })
    );

    expect(
      repository.pruneOperationalIntegrityEvents({
        now: "2027-01-01T00:00:00.000Z",
        reason: "retention"
      })
    ).toBe(2);
    expect(repository.listIntegrityEvents({ category: "operational" }).map((e) => e.id)).toEqual([
      "op-shared",
      "op-newest",
      "op-recent"
    ]);
    expect(repository.listIntegrityEvents({ category: "audit" })).toHaveLength(1);
    expect(repository.listRetentionDeletions()).toEqual([
      {
        sequence: 1,
        occurredAt: "2027-01-01T00:00:00.000Z",
        category: "operational",
        reason: "retention",
        deletedCount: 2,
        rangeStart: old,
        rangeEnd: old
      }
    ]);
    expect(
      repository.pruneOperationalIntegrityEvents({
        now: "2027-01-01T00:00:00.000Z",
        reason: "retention"
      })
    ).toBe(0);
    expect(repository.listRetentionDeletions()).toHaveLength(1);
  });

  it("purges audit and review projections with an aggregate ledger row only", async () => {
    const { repository } = await createRepository();
    const identity = storedIdentity();
    repository.saveFindingIdentity(identity);
    seedScan(repository, "scan-1");
    seedFinding(repository, "finding-1", "scan-1");
    repository.saveFindingOccurrence(storedOccurrence(identity.stableKey, "scan-1", "finding-1"));
    repository.appendIntegrityEvent(
      newEvent({
        id: "audit-1",
        category: "audit",
        kind: "proposal-approved",
        occurredAt: "2026-01-01T00:00:00.000Z"
      })
    );
    repository.appendIntegrityEvent(
      newEvent({
        id: "audit-2",
        category: "audit",
        kind: "apply-succeeded",
        occurredAt: "2026-02-01T00:00:00.000Z"
      })
    );
    repository.appendIntegrityEvent(
      newEvent({
        id: "review-1",
        category: "review",
        kind: "finding-opened",
        occurredAt: "2026-02-15T00:00:00.000Z"
      })
    );
    repository.appendIntegrityEvent(
      newEvent({ id: "op-1", occurredAt: "2026-01-15T00:00:00.000Z" })
    );

    expect(
      repository.purgeIntegrityEvents({
        category: "audit",
        reason: "compaction",
        occurredAt: { through: "2026-01-31T00:00:00.000Z" }
      })
    ).toBe(1);
    expect(repository.listIntegrityEvents({ category: "audit" }).map((e) => e.id)).toEqual([
      "audit-2"
    ]);
    expect(repository.purgeIntegrityEvents({ category: "review", reason: "compaction" })).toBe(1);
    expect(repository.listIntegrityEvents()).toHaveLength(2);
    expect(repository.listRetentionDeletions().map((row) => row.category)).toEqual([
      "audit",
      "review"
    ]);
    expect(repository.listFindingIdentities()).toHaveLength(1);
    expect(repository.listFindingOccurrences()).toHaveLength(1);
    expect(repository.listFindings()).toHaveLength(1);

    expect(() =>
      repository.purgeIntegrityEvents({ category: "operational" as "audit", reason: "nope" })
    ).toThrow();
    expect(() =>
      repository.purgeIntegrityEvents({
        category: "audit",
        reason: "nope",
        occurredAt: { from: "bad" }
      })
    ).toThrow();
    expect(
      repository.purgeIntegrityEvents({
        category: "audit",
        reason: "again",
        occurredAt: { from: "2030-01-01T00:00:00.000Z" }
      })
    ).toBe(0);
  });

  it("keeps every integrity event category when trace data is deleted", async () => {
    const { repository } = await createRepository();
    repository.appendIntegrityEvent(
      newEvent({ id: "audit-1", category: "audit", kind: "proposal-approved" })
    );
    repository.appendIntegrityEvent(
      newEvent({ id: "review-1", category: "review", kind: "finding-opened" })
    );
    repository.appendIntegrityEvent(newEvent({ id: "op-1" }));

    repository.deleteAllTraceData("2026-09-29T00:00:00.000Z", "delete-1");
    expect(repository.listIntegrityEvents().map((e) => e.category)).toEqual([
      "audit",
      "review",
      "operational"
    ]);
  });
});

describe("legacy finding backfill", () => {
  const patch = (id: string, findingId: string, scanId: string) =>
    JSON.stringify({
      schemaVersion: 1,
      id,
      findingId,
      scanId,
      explanation: "Repair the broken reference.",
      operations: [
        {
          kind: "replace-range",
          path: "Home.md",
          sourceRevision: "revision-1",
          start: 0,
          end: 1,
          expected: "x",
          replacement: "y"
        }
      ]
    });

  it("derives isolated v0 identities and occurrences for legacy findings", async () => {
    const { repository } = await createRepository();
    seedScan(repository, "scan-1");
    seedScan(repository, "scan-2");
    repository.saveFinding({
      id: "finding-1",
      scanId: "scan-1",
      type: "broken-reference",
      severity: "medium",
      status: "open",
      evidenceJson: '[{"notePath":"Home.md","locator":"line:1","excerpt":"[[Missing]]"}]',
      payloadJson: "{}"
    });
    repository.saveFinding({
      id: "finding-2",
      scanId: "scan-2",
      type: "broken-reference",
      severity: "medium",
      status: "open",
      evidenceJson: '[{"notePath":"Home.md","locator":"line:1","excerpt":"[[Missing]]"}]',
      payloadJson: "{}"
    });
    repository.saveProposal({
      id: "proposal-1",
      findingId: "finding-1",
      patchJson: patch("proposal-1", "finding-1", "scan-1"),
      sourceRevisionsJson: "{}",
      status: "approved"
    });
    const proposalDigest = repository.findProposal("proposal-1")?.proposalDigest;
    expect(proposalDigest).toBeTruthy();
    repository.recordApproval({
      id: "approval-1",
      proposalId: "proposal-1",
      action: "approved",
      actedAt: TIMESTAMP,
      appliedRevision: null,
      proposalDigest: proposalDigest ?? null
    });

    expect(repository.backfillLegacyFindingOccurrences()).toBe(2);
    expect(repository.backfillLegacyFindingOccurrences()).toBe(0);

    const occurrences = repository.listFindingOccurrences();
    expect(occurrences).toHaveLength(2);
    const evidenceJson = '[{"notePath":"Home.md","locator":"line:1","excerpt":"[[Missing]]"}]';
    for (const [scanId, findingId] of [
      ["scan-1", "finding-1"],
      ["scan-2", "finding-2"]
    ] as const) {
      const stableKey = `finding:v0:${createHash("sha256")
        .update(JSON.stringify([scanId, findingId]))
        .digest("hex")}`;
      const evidenceRevisionKey = `evidence:v0:${createHash("sha256")
        .update(JSON.stringify([scanId, findingId, evidenceJson]))
        .digest("hex")}`;
      const occurrenceId = `occurrence:v0:${createHash("sha256")
        .update(JSON.stringify([stableKey, scanId, evidenceRevisionKey]))
        .digest("hex")}`;
      expect(occurrences.find((occurrence) => occurrence.findingId === findingId)).toEqual({
        occurrenceId,
        stableKey,
        findingId,
        scanId,
        evidenceRevisionKey,
        identityVersion: 0
      });
    }
    expect(occurrences[0]?.stableKey).not.toBe(occurrences[1]?.stableKey);

    const identities = repository.listFindingIdentities();
    expect(identities).toHaveLength(2);
    for (const identity of identities) {
      expect(identity).toMatchObject({
        identityVersion: 0,
        family: "broken-reference",
        subtype: "legacy",
        detectorId: "legacy-backfill",
        detectorVersion: "0",
        policyId: null,
        policyVersion: null,
        subjectIds: []
      });
      expect(identity.semanticKey).toMatch(/^finding-[12]$/);
    }

    expect(repository.findProposal("proposal-1")?.proposalDigest).toBe(proposalDigest);
    expect(repository.getApprovedProposalDigest("proposal-1")).toBe(proposalDigest);
  });
});

describe("transactional event composition", () => {
  const patch = (id: string, findingId: string, scanId: string) =>
    JSON.stringify({
      schemaVersion: 1,
      id,
      findingId,
      scanId,
      explanation: "Repair.",
      operations: [
        {
          kind: "replace-range",
          path: "Home.md",
          sourceRevision: "revision-1",
          start: 0,
          end: 1,
          expected: "x",
          replacement: "y"
        }
      ]
    });

  it("rejects nested withTransaction calls", async () => {
    const { repository } = await createRepository();
    expect(() =>
      repository.withTransaction(() => repository.withTransaction(() => undefined))
    ).toThrow();
  });

  it("does not poison later transactions when BEGIN fails", async () => {
    const { database, repository } = await createRepository();
    const originalRun = database.run.bind(database);
    let failOnce = true;
    database.run = ((sql: string, params?: unknown) => {
      if (failOnce && sql === "BEGIN IMMEDIATE") {
        failOnce = false;
        throw new Error("disk locked");
      }
      return originalRun(sql, params as never);
    }) as typeof database.run;

    expect(() => repository.withTransaction(() => undefined)).toThrow("disk locked");

    repository.withTransaction(() => {
      seedScan(repository, "scan-after-failure");
    });
    expect(repository.getRecordCounts().scans).toBe(1);
  });

  it("lets appendIntegrityEvent join an open transaction and rolls back together", async () => {
    const { repository } = await createRepository();
    expect(() =>
      repository.withTransaction(() => {
        seedScan(repository, "scan-tx", "running", TIMESTAMP, null);
        repository.appendIntegrityEvent(
          newEvent({
            id: "event-tx",
            kind: "scan-started",
            scanId: "scan-tx",
            proposalId: "missing-proposal",
            safeMetadata: { count: 1 }
          })
        );
      })
    ).toThrow("unknown proposal");
    expect(repository.getRecordCounts().scans).toBe(0);
    expect(repository.listIntegrityEvents()).toEqual([]);

    repository.withTransaction(() => {
      seedScan(repository, "scan-ok", "running", TIMESTAMP, null);
      repository.appendIntegrityEvent(
        newEvent({
          id: "event-ok",
          kind: "scan-started",
          scanId: "scan-ok",
          safeMetadata: { count: 1 }
        })
      );
    });
    expect(repository.listIntegrityEvents({ scanId: "scan-ok" })).toEqual([
      expect.objectContaining({ kind: "scan-started" })
    ]);
  });

  it("commits a proposal and its audit event atomically, and rolls back on event conflict", async () => {
    const { repository } = await createRepository();
    seedScan(repository, "scan-1");
    seedFinding(repository, "finding-1", "scan-1");

    repository.saveProposal(
      {
        id: "proposal-1",
        findingId: "finding-1",
        patchJson: patch("proposal-1", "finding-1", "scan-1"),
        sourceRevisionsJson: "{}",
        status: "pending"
      },
      newEvent({
        id: "audit-prepared",
        category: "audit",
        kind: "proposal-prepared",
        scanId: "scan-1",
        proposalId: "proposal-1",
        safeMetadata: {}
      })
    );
    expect(repository.findProposal("proposal-1")).not.toBeNull();
    expect(repository.listIntegrityEvents({ category: "audit" })).toEqual([
      expect.objectContaining({ kind: "proposal-prepared", proposalId: "proposal-1" })
    ]);

    repository.appendIntegrityEvent(
      newEvent({ id: "audit-conflict", kind: "scan-completed", safeMetadata: {} })
    );
    expect(() =>
      repository.saveProposal(
        {
          id: "proposal-2",
          findingId: "finding-1",
          patchJson: patch("proposal-2", "finding-1", "scan-1"),
          sourceRevisionsJson: "{}",
          status: "pending"
        },
        newEvent({
          id: "audit-conflict",
          category: "audit",
          kind: "proposal-prepared",
          proposalId: "proposal-2",
          safeMetadata: {}
        })
      )
    ).toThrow("conflict");
    expect(repository.findProposal("proposal-2")).toBeNull();
  });

  it("rejects an audit event bound to a different proposal id", async () => {
    const { repository } = await createRepository();
    seedScan(repository, "scan-1");
    seedFinding(repository, "finding-1", "scan-1");
    seedScan(repository, "scan-2");
    seedFinding(repository, "finding-2", "scan-2");
    repository.saveProposal({
      id: "proposal-other",
      findingId: "finding-2",
      patchJson: patch("proposal-other", "finding-2", "scan-2"),
      sourceRevisionsJson: "{}",
      status: "pending"
    });

    expect(() =>
      repository.saveProposal(
        {
          id: "proposal-1",
          findingId: "finding-1",
          patchJson: patch("proposal-1", "finding-1", "scan-1"),
          sourceRevisionsJson: "{}",
          status: "pending"
        },
        newEvent({
          id: "audit-mismatched",
          category: "audit",
          kind: "proposal-prepared",
          proposalId: "proposal-other",
          safeMetadata: {}
        })
      )
    ).toThrow("does not match");
    expect(repository.findProposal("proposal-1")).toBeNull();
  });
});
