import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { persistReviewQueue } from "../../src/coordinator/normalize.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

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
});
