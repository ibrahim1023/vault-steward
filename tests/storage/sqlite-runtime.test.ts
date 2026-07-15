import { describe, expect, it } from "vitest";

import { createSqliteRuntime, getPluginDatabasePath } from "../../src/storage/sqlite-runtime.js";

describe("SQLite runtime compatibility spike", () => {
  it("uses a plugin-local database path", () => {
    expect(getPluginDatabasePath(".obsidian", "vault-steward")).toBe(
      ".obsidian/plugins/vault-steward/vault-steward.sqlite"
    );
  });

  it("opens, exports, and closes an in-memory SQLite database", async () => {
    const runtime = await createSqliteRuntime({
      locateFile: (file) => `node_modules/sql.js/dist/${file}`
    });

    runtime.database.run("CREATE TABLE probe (value TEXT NOT NULL)");
    runtime.database.run("INSERT INTO probe VALUES (?)", ["ready"]);

    expect(runtime.database.exec("SELECT value FROM probe")).toEqual([
      { columns: ["value"], values: [["ready"]] }
    ]);
    expect(runtime.exportDatabase()).toBeInstanceOf(Uint8Array);

    runtime.close();
    expect(() => runtime.exportDatabase()).toThrow("closed");
  });
});
