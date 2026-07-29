import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

describe("finding lifecycle history", () => {
  it("derives recurrence, stale, and resolved state from completed scans without exposing note bodies", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    for (const [id, startedAt] of [
      ["scan-1", "2026-07-13"],
      ["scan-2", "2026-07-14"],
      ["scan-3", "2026-07-15"]
    ] as const) {
      repository.saveScan({
        id,
        vaultFingerprint: "vault",
        startedAt,
        finishedAt: startedAt,
        status: "completed",
        configHash: "config",
        inputHash: id,
        parserVersion: "scanner-v1"
      });
    }
    for (const [id, scanId, status] of [
      ["f-1", "scan-1", "open"],
      ["f-2", "scan-2", "stale"]
    ] as const) {
      repository.saveFinding({
        id,
        scanId,
        type: "broken-reference",
        severity: "warning",
        status,
        evidenceJson: '[{"notePath":"Private.md"}]',
        payloadJson: '{"confidence":1,"explanation":"x"}'
      });
    }

    expect(repository.listFindingLifecycle()).toEqual([
      expect.objectContaining({
        type: "broken-reference",
        severity: "warning",
        firstSeen: "2026-07-13",
        lastSeen: "2026-07-14",
        occurrences: 2,
        stale: true,
        resolved: true
      })
    ]);
  });
});
