import initSqlJs from "sql.js";
import { describe, expect, it, vi } from "vitest";

import { generateStructured } from "../../src/model-provider/structured.js";
import {
  createLocalProvider,
  type LocalProvider
} from "../../src/model-provider/local-provider.js";
import { ReviewWorkflow } from "../../src/review/workflow.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { ScanSnapshotRepository } from "../../src/storage/scan-snapshots.js";
import { createSqliteRuntime } from "../../src/storage/sqlite-runtime.js";
import {
  ObsidianVaultReader,
  ObsidianVaultWriter,
  type VaultEventSource,
  type VaultFileHandle,
  type WritableVaultEventSource
} from "../../src/vault-adapter/obsidian-reader.js";

class FailingVault implements WritableVaultEventSource {
  getFiles(): VaultFileHandle[] {
    return [{ path: "Home.md", extension: "md" }];
  }
  async read(): Promise<string> {
    throw new Error("disk unavailable");
  }
  async modify(): Promise<void> {
    throw new Error("disk unavailable");
  }
  on(): unknown {
    return {};
  }
  offref(): void {}
}

class EventVault implements VaultEventSource {
  private callback: ((...args: unknown[]) => void) | null = null;
  getFiles(): VaultFileHandle[] {
    return [{ path: "Home.md", extension: "md" }];
  }
  async read(): Promise<string> {
    return "# Home";
  }
  on(_event: string, callback: (...args: unknown[]) => void): unknown {
    this.callback = callback;
    return {};
  }
  offref(): void {}
  emitDuplicateModify(): void {
    this.callback?.({ path: "Home.md", extension: "md" });
    this.callback?.({ path: "Home.md", extension: "md" });
  }
}

const proposal = {
  schemaVersion: 1 as const,
  id: "proposal",
  findingId: "finding",
  scanId: "scan",
  explanation: "repair",
  operations: [
    {
      kind: "replace-range" as const,
      path: "Home.md",
      sourceRevision: "r",
      start: 0,
      end: 1,
      expected: "x",
      replacement: "y"
    }
  ]
};

describe("failure injection", () => {
  it("rejects corrupt database bytes and rolls back failed migrations", async () => {
    await expect(
      createSqliteRuntime({
        locateFile: (file) => `node_modules/sql.js/dist/${file}`,
        databaseBytes: new Uint8Array([1, 2, 3])
      })
    ).rejects.toThrow();
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    expect(() => applyMigrations(database, [{ version: 1, sql: "THIS IS NOT SQL" }])).toThrow();
    expect(
      database.exec("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'")
    ).toEqual([{ columns: ["name"], values: [["schema_migrations"]] }]);
  });

  it("fails vault reads and writes, and cancels before an apply write", async () => {
    const vault = new FailingVault();
    await expect(new ObsidianVaultReader(vault).listFiles()).rejects.toThrow("disk unavailable");
    await expect(new ObsidianVaultWriter(vault).write("Home.md", "next")).rejects.toThrow(
      "disk unavailable"
    );
    const workflow = new ReviewWorkflow({ getProposalStatus: () => "approved" } as never, {
      read: async () => ({ content: "x", revision: "r" }),
      write: vi.fn()
    });
    const controller = new AbortController();
    controller.abort();
    await expect(workflow.apply(proposal, "trace", { signal: controller.signal })).resolves.toEqual(
      { ok: false, reason: "canceled" }
    );
  });

  it("contains provider timeout and malformed output, and deduplicates vault events", async () => {
    const provider = createLocalProvider(
      {
        kind: "ollama",
        endpoint: "http://localhost:11434",
        model: "local",
        timeoutMs: 1,
        maxResponseBytes: 1000
      },
      (_url, init) =>
        new Promise((_resolve, reject) =>
          (init?.signal as AbortSignal).addEventListener("abort", () => reject(new Error("abort")))
        )
    );
    await expect(provider.generate({ prompt: "x", maxOutputTokens: 1 })).rejects.toThrow(
      "timed out"
    );
    const malformed: LocalProvider = {
      ...provider,
      generate: async () => ({ text: "not-json", model: "local", provider: "ollama", latencyMs: 1 })
    };
    await expect(
      generateStructured(
        [malformed],
        { prompt: "x", maxOutputTokens: 1 },
        (value): value is { ok: true } =>
          typeof value === "object" && value !== null && "ok" in value
      )
    ).resolves.toMatchObject({ ok: false });
    const events = new EventVault();
    const reader = new ObsidianVaultReader(events);
    reader.watchInvalidations();
    events.emitDuplicateModify();
    expect(reader.consumeInvalidatedPaths()).toEqual(["Home.md"]);
  });

  it("marks running scans failed for restart recovery", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const snapshots = new ScanSnapshotRepository(database);
    snapshots.createSnapshot({
      id: "interrupted",
      vaultFingerprint: "vault",
      startedAt: "now",
      configHash: "config",
      inputHash: "input",
      parserVersion: "1",
      files: []
    });
    expect(snapshots.recoverInterruptedScans("later")).toBe(1);
  });
});
