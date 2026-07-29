import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

async function createRepository() {
  const SQL = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
  const database = new SQL.Database();
  applyMigrations(database);
  return new VaultStewardRepository(database);
}

describe("observability repository", () => {
  it("returns a content-free timeline, configuration, and lineage for a scan", async () => {
    const repository = await createRepository();
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "2026-07-16T00:00:00.000Z",
      finishedAt: "2026-07-16T00:00:01.000Z",
      status: "completed",
      configHash: "legacy",
      inputHash: "input",
      parserVersion: "scanner-v1"
    });
    repository.saveTraceSpan({
      schemaVersion: 1,
      id: "scan-1:scanner",
      scanId: "scan-1",
      parentSpanId: "scan-1:root",
      kind: "scanner",
      startedAt: "2026-07-16T00:00:00.000Z",
      completedAt: "2026-07-16T00:00:00.025Z",
      outcome: "success",
      correlationId: "scan-scan-1",
      attributes: { fileCount: 2 }
    });
    repository.saveFinding({
      id: "finding-1",
      scanId: "scan-1",
      type: "task",
      severity: "low",
      status: "open",
      evidenceJson: "[]",
      payloadJson: "{}"
    });
    repository.saveFindingLineage({
      schemaVersion: 1,
      findingId: "finding-1",
      scanId: "scan-1",
      evidenceLocators: ["Tasks.md (line:3)"],
      parsedArtifactIds: ["parse:Tasks.md"],
      validatorId: "finding-normalization",
      coordinatorDecisionId: "coordinator:scan-1",
      correlationId: "scan-scan-1"
    });
    repository.saveTraceConfiguration({
      scanId: "scan-1",
      fingerprint: "a".repeat(64),
      values: { model: "llama3.1:8b", parser: "scanner-v1" }
    });

    expect(repository.getObservabilitySnapshot("scan-1")).toMatchObject({
      timeline: [
        expect.objectContaining({
          kind: "scanner",
          parentSpanId: "scan-1:root",
          durationMs: 25,
          fileCount: 2,
          attributes: { fileCount: 2 }
        })
      ],
      configuration: {
        fingerprint: "a".repeat(64),
        values: { model: "llama3.1:8b", parser: "scanner-v1" }
      },
      lineage: [
        expect.objectContaining({ findingId: "finding-1", evidenceLocators: ["Tasks.md (line:3)"] })
      ],
      metrics: expect.objectContaining({
        queueDepth: 1,
        p50ScanDurationMs: 25,
        p95ScanDurationMs: 25
      })
    });
  });

  it("defaults optional snapshot capture off and rejects unsafe snapshots", async () => {
    const repository = await createRepository();
    expect(repository.getTracePreferences()).toMatchObject({
      storePromptSnapshots: false,
      storeModelOutputSnapshots: false,
      redactExcerpts: true
    });
    expect(() => repository.saveTraceSnapshot("scan-1", "prompt", "secret\nbody")).toThrow(
      "Trace snapshot is invalid."
    );
  });
});
