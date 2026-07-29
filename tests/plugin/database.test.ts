import { describe, expect, it } from "vitest";

import { openPluginDatabase } from "../../src/plugin/database.js";

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

describe("plugin database lifecycle", () => {
  it("migrates, persists, and reopens the plugin-local SQLite database", async () => {
    const store = new MemoryBinaryStore();
    const first = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    await expect(store.exists()).resolves.toBe(true);
    first.repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: "later",
      status: "completed",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser"
    });
    await first.flush();
    first.close();

    const reopened = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    expect(reopened.repository.getRecordCounts().scans).toBe(1);
    reopened.close();
  });

  it("marks a snapshot failed when persistence after snapshot creation throws", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    const duplicateFinding = {
      schemaVersion: 1 as const,
      id: "duplicate",
      scanId: "scan-failure",
      type: "broken-reference" as const,
      severity: "medium" as const,
      evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["Home.md"],
      explanation: "Missing target",
      suggestedFixes: [],
      confidence: 1,
      status: "open" as const
    };

    expect(() =>
      database.saveCompletedScan({
        id: "scan-failure",
        vaultFingerprint: "vault",
        configHash: "config",
        inputHash: "input",
        parserVersion: "parser",
        startedAt: "2026-07-15T12:00:00Z",
        finishedAt: "2026-07-15T12:00:01Z",
        files: [],
        parseProducts: [],
        findings: [
          duplicateFinding,
          {
            ...duplicateFinding,
            evidence: [{ notePath: "Home.md", locator: "line:2", excerpt: "[[Also Missing]]" }]
          }
        ],
        modelTraces: []
      })
    ).toThrow();
    expect(database.loadHistory().scans[0]).toMatchObject({ id: "scan-failure", status: "failed" });
    database.close();
  });

  it("loads findings from only the latest completed scan", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    const createFinding = (id: string, scanId: string) => ({
      schemaVersion: 1 as const,
      id,
      scanId,
      type: "broken-reference" as const,
      severity: "medium" as const,
      evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["Home.md"],
      explanation: "Missing target",
      suggestedFixes: [],
      confidence: 1,
      status: "open" as const
    });
    const saveScan = (id: string, finishedAt: string) =>
      database.saveCompletedScan({
        id,
        vaultFingerprint: "vault",
        configHash: "config",
        inputHash: id,
        parserVersion: "parser",
        startedAt: "2026-07-15T12:00:00Z",
        finishedAt,
        files: [],
        parseProducts: [],
        findings: [createFinding(`finding-${id}`, id)],
        modelTraces: []
      });

    saveScan("scan-older", "2026-07-15T12:00:01Z");
    saveScan("scan-latest", "2026-07-15T12:00:02Z");

    expect(database.loadFindings()).toMatchObject([
      { id: "finding-scan-latest", scanId: "scan-latest" }
    ]);
    database.close();
  });

  it("records bounded stage spans and a configuration fingerprint for an inspectable scan", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    database.saveCompletedScan({
      id: "scan-observable",
      vaultFingerprint: "vault",
      configHash: "a".repeat(64),
      inputHash: "input",
      parserVersion: "parser",
      startedAt: "2026-07-16T00:00:00.000Z",
      finishedAt: "2026-07-16T00:00:01.000Z",
      files: [],
      parseProducts: [],
      findings: [],
      modelTraces: [],
      traceConfiguration: { fingerprint: "a".repeat(64), values: { model: "llama3.1:8b" } }
    });

    const snapshot = database.loadObservability("scan-observable");
    expect(snapshot.timeline.map((span) => span.kind)).toEqual(
      expect.arrayContaining([
        "scanner",
        "parser",
        "indexing",
        "retrieval",
        "agent",
        "validation",
        "policy",
        "coordinator",
        "finding",
        "proposal",
        "apply"
      ])
    );
    expect(snapshot.configuration).toEqual({
      fingerprint: "a".repeat(64),
      values: { model: "llama3.1:8b" }
    });
    database.close();
  });

  it("does not persist a reviewable finding when deterministic lineage is incomplete", async () => {
    const store = new MemoryBinaryStore();
    const database = await openPluginDatabase({
      adapter: store,
      databasePath: ".obsidian/plugins/vault-steward/vault-steward.sqlite",
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });
    database.saveCompletedScan({
      id: "scan-incomplete-lineage",
      vaultFingerprint: "vault",
      configHash: "config",
      inputHash: "input",
      parserVersion: "parser",
      startedAt: "2026-07-29T00:00:00.000Z",
      finishedAt: "2026-07-29T00:00:01.000Z",
      files: [],
      parseProducts: [],
      findings: [
        {
          schemaVersion: 1,
          id: "unsupported",
          scanId: "scan-incomplete-lineage",
          type: "task",
          severity: "low",
          evidence: [],
          affectedNoteIds: [],
          explanation: "No source evidence.",
          suggestedFixes: [],
          confidence: 1,
          status: "open"
        }
      ],
      modelTraces: []
    });
    expect(database.loadFindings()).toEqual([]);
    expect(database.loadObservability("scan-incomplete-lineage").lineage).toEqual([]);
    database.close();
  });
});
