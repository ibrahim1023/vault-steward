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
  })
);
