import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

describe("persisted review queue", () => {
  it("filters finding rows through the typed query contract", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: "later",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    repository.saveFinding({
      id: "task-1",
      scanId: "scan-1",
      type: "task",
      severity: "medium",
      status: "open",
      evidenceJson: "[]",
      payloadJson: '{"confidence":0.9}'
    });
    repository.saveFinding({
      id: "reference-1",
      scanId: "scan-1",
      type: "broken-reference",
      severity: "low",
      status: "dismissed",
      evidenceJson: "[]",
      payloadJson: '{"confidence":1}'
    });

    expect(
      repository.listFindings({ scanId: "scan-1", status: "open", minimumConfidence: 0.8 })
    ).toEqual([expect.objectContaining({ id: "task-1", type: "task" })]);
  });
});
