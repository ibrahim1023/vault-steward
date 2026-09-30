import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { persistReviewQueue } from "../../src/coordinator/normalize.js";
import { createReferenceFindingIdentity } from "../../src/findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../../src/findings/normalize.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { hydrateFinding, VaultStewardRepository } from "../../src/storage/repositories.js";

describe("deterministic coordinator", () => {
  it("persists one evidence-valid finding and rejects invalid or duplicate candidates", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "2026-07-13T00:00:00Z",
      finishedAt: null,
      status: "running",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    const finding = {
      schemaVersion: 1 as const,
      id: "finding-1",
      scanId: "scan-1",
      type: "broken-reference" as const,
      severity: "high" as const,
      evidence: [{ notePath: "A.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["A.md"],
      explanation: "Missing",
      suggestedFixes: [],
      confidence: 1,
      status: "open" as const
    };
    expect(
      persistReviewQueue(repository, [
        finding,
        { ...finding, id: "duplicate" },
        { ...finding, id: "invalid", evidence: [], confidence: 2 }
      ])
    ).toEqual([finding]);
    expect(repository.getRecordCounts().findings).toBe(1);
  });

  it("persists a v2 finding with its canonical identity and occurrence rows", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "2026-07-13T00:00:00Z",
      finishedAt: null,
      status: "running",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    const promoted: PromotedEvidence = {
      notePath: "A.md",
      locator: "line:1",
      excerpt: "[[Missing]]",
      role: "reference",
      subjectId: "subject-a",
      sourceRevision: "rev-a"
    };
    const v2 = normalizeFinding({
      scanId: "scan-1",
      type: "broken-reference",
      severity: "high",
      identity: createReferenceFindingIdentity({
        family: "broken-reference",
        subtype: "missing",
        sourceSubjectId: "subject-a",
        normalizedTarget: "Missing.md"
      }),
      evidence: [promoted],
      availableEvidence: [promoted],
      explanation: "Missing",
      confidence: 1
    });
    expect(v2).not.toBeNull();
    if (!v2) return;

    expect(persistReviewQueue(repository, [v2])).toEqual([v2]);
    expect(repository.listFindingIdentities().map((item) => item.stableKey)).toEqual([
      v2.stableKey
    ]);
    expect(
      repository.listFindingOccurrences({ scanId: "scan-1" }).map((item) => item.occurrenceId)
    ).toEqual([v2.occurrenceId]);

    const persisted = repository.listFindings({ scanId: "scan-1" });
    expect(persisted).toHaveLength(1);
    const hydrated = hydrateFinding(persisted[0]!);
    expect(hydrated).toMatchObject({ schemaVersion: 2, id: v2.id, stableKey: v2.stableKey });
  });

  it("throws an exact duplicate error when a v2 occurrence repeats", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "2026-07-13T00:00:00Z",
      finishedAt: null,
      status: "running",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    const promoted: PromotedEvidence = {
      notePath: "A.md",
      locator: "line:1",
      excerpt: "[[Missing]]",
      role: "reference",
      subjectId: "subject-a",
      sourceRevision: "rev-a"
    };
    const v2 = normalizeFinding({
      scanId: "scan-1",
      type: "broken-reference",
      severity: "high",
      identity: createReferenceFindingIdentity({
        family: "broken-reference",
        subtype: "missing",
        sourceSubjectId: "subject-a",
        normalizedTarget: "Missing.md"
      }),
      evidence: [promoted],
      availableEvidence: [promoted],
      explanation: "Missing",
      confidence: 1
    });
    if (!v2) throw new Error("expected v2 finding");

    expect(() => persistReviewQueue(repository, [v2, { ...v2 }])).toThrow(
      "duplicate finding occurrence"
    );
  });

  it("rolls back identity and occurrence writes when a finding insert fails", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "2026-07-13T00:00:00Z",
      finishedAt: null,
      status: "running",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    const promoted: PromotedEvidence = {
      notePath: "A.md",
      locator: "line:1",
      excerpt: "[[Missing]]",
      role: "reference",
      subjectId: "subject-a",
      sourceRevision: "rev-a"
    };
    const v2 = normalizeFinding({
      scanId: "scan-1",
      type: "broken-reference",
      severity: "high",
      identity: createReferenceFindingIdentity({
        family: "broken-reference",
        subtype: "missing",
        sourceSubjectId: "subject-a",
        normalizedTarget: "Missing.md"
      }),
      evidence: [promoted],
      availableEvidence: [promoted],
      explanation: "Missing",
      confidence: 1
    });
    if (!v2) throw new Error("expected v2 finding");

    repository.saveFinding({
      id: v2.id,
      scanId: "scan-1",
      type: "broken-reference",
      severity: "high",
      status: "open",
      evidenceJson: "[]",
      payloadJson: "{}"
    });
    const before = repository.getRecordCounts().findings;

    expect(() => persistReviewQueue(repository, [v2])).toThrow();
    expect(repository.listFindingIdentities()).toHaveLength(0);
    expect(repository.listFindingOccurrences()).toHaveLength(0);
    expect(repository.getRecordCounts().findings).toBe(before);
  });
});
