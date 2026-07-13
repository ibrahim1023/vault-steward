import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/storage/migrations.js";
import { ScanSnapshotRepository } from "../../src/storage/scan-snapshots.js";

async function createRepository(): Promise<ScanSnapshotRepository> {
  const sql = await initSqlJs({
    locateFile: (file) => `node_modules/sql.js/dist/${file}`
  });
  const database = new sql.Database();
  applyMigrations(database);
  return new ScanSnapshotRepository(database);
}

describe("scan snapshot repository", () => {
  it("persists immutable inputs and replays a completed snapshot", async () => {
    const repository = await createRepository();
    repository.createSnapshot({
      id: "scan-1",
      vaultFingerprint: "vault-1",
      startedAt: "2026-07-13T00:00:00.000Z",
      configHash: "config-1",
      inputHash: "input-1",
      parserVersion: "parser-1",
      files: [{ path: "Home.md", revisionHash: "revision-1" }]
    });
    repository.transition("scan-1", "completed", "2026-07-13T00:01:00.000Z");

    expect(repository.getCompletedSnapshot("scan-1")).toEqual({
      id: "scan-1",
      vaultFingerprint: "vault-1",
      status: "completed",
      inputHash: "input-1",
      parserVersion: "parser-1",
      files: [{ path: "Home.md", revisionHash: "revision-1" }]
    });
  });

  it("rejects invalid transitions and never changes immutable scan inputs", async () => {
    const repository = await createRepository();
    repository.createSnapshot({
      id: "scan-1",
      vaultFingerprint: "vault-1",
      startedAt: "2026-07-13T00:00:00.000Z",
      configHash: "config-1",
      inputHash: "input-1",
      parserVersion: "parser-1",
      files: [{ path: "Home.md", revisionHash: "revision-1" }]
    });
    repository.transition("scan-1", "canceled", "2026-07-13T00:01:00.000Z");

    expect(() => repository.transition("scan-1", "completed", "2026-07-13T00:02:00.000Z")).toThrow(
      "cannot transition"
    );
    expect(() =>
      repository.createSnapshot({
        id: "scan-1",
        vaultFingerprint: "vault-1",
        startedAt: "2026-07-13T00:02:00.000Z",
        configHash: "config-2",
        inputHash: "input-2",
        parserVersion: "parser-2",
        files: []
      })
    ).toThrow();
  });

  it("marks interrupted scans failed and reuses an identical completed snapshot", async () => {
    const repository = await createRepository();
    repository.createSnapshot({
      id: "scan-interrupted",
      vaultFingerprint: "vault-1",
      startedAt: "2026-07-13T00:00:00.000Z",
      configHash: "config-1",
      inputHash: "input-interrupted",
      parserVersion: "parser-1",
      files: []
    });
    repository.createSnapshot({
      id: "scan-completed",
      vaultFingerprint: "vault-1",
      startedAt: "2026-07-13T00:01:00.000Z",
      configHash: "config-1",
      inputHash: "input-1",
      parserVersion: "parser-1",
      files: []
    });
    repository.transition("scan-completed", "completed", "2026-07-13T00:02:00.000Z");

    expect(repository.recoverInterruptedScans("2026-07-13T00:03:00.000Z")).toBe(1);
    expect(repository.findReusableCompletedSnapshot("vault-1", "input-1", "parser-1")?.id).toBe(
      "scan-completed"
    );
    expect(repository.findReusableCompletedSnapshot("vault-1", "input-2", "parser-1")).toBeNull();
  });
});
