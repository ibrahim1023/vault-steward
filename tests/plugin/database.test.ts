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
});
