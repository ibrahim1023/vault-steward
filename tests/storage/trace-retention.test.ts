import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

describe("trace retention", () =>
  it("deletes trace records without deleting approvals", async () => {
    const SQL = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new SQL.Database();
    applyMigrations(database);
    const repo = new VaultStewardRepository(database);
    expect(repo.getTraceInventory()).toMatchObject({ spans: 0, retentionDays: 30 });
    repo.setTraceRetention(14, "now");
    expect(repo.getTraceInventory().retentionDays).toBe(14);
    repo.deleteAllTraceData("now", "delete-1");
    expect(repo.getRecordCounts().approvals).toBe(0);
  }));

describe("trace retention cleanup", () =>
  it("prunes only expired trace categories and keeps the scan record", async () => {
    const SQL = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new SQL.Database();
    applyMigrations(database);
    const repo = new VaultStewardRepository(database);
    repo.saveScan({
      id: "old-scan",
      vaultFingerprint: "vault",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    repo.saveTraceSpan({
      schemaVersion: 1,
      id: "old-scan:root",
      scanId: "old-scan",
      kind: "governed-scan",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
      outcome: "success",
      correlationId: "old-scan",
      attributes: {}
    });

    expect(repo.pruneExpiredTraceData("2026-02-15T00:00:00.000Z")).toBe(1);
    expect(repo.getTraceInventory().spans).toBe(0);
    expect(repo.listScanHistory(1)).toEqual([
      expect.objectContaining({ id: "old-scan", status: "completed" })
    ]);
  }));
