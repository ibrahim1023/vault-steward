import initSqlJs, { type Database } from "sql.js";

export interface SqliteRuntimeOptions {
  readonly locateFile: (file: string) => string;
  readonly databaseBytes?: Uint8Array;
}

export interface SqliteRuntime {
  readonly database: Database;
  exportDatabase(): Uint8Array;
  close(): void;
}

export function getPluginDatabasePath(configDir: string, pluginId: string): string {
  const normalizedConfigDir = normalizePathPart(configDir, "configDir");
  const normalizedPluginId = normalizePathPart(pluginId, "pluginId");

  return `${normalizedConfigDir}/plugins/${normalizedPluginId}/vault-steward.sqlite`;
}

export async function createSqliteRuntime(options: SqliteRuntimeOptions): Promise<SqliteRuntime> {
  const sql = await initSqlJs({ locateFile: options.locateFile });
  const database = new sql.Database(options.databaseBytes);
  let closed = false;

  return {
    database,
    exportDatabase() {
      assertOpen(closed);
      return database.export();
    },
    close() {
      if (!closed) {
        database.close();
        closed = true;
      }
    }
  };
}

function normalizePathPart(value: string, fieldName: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");

  if (
    normalized.length === 0 ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${fieldName} must be a normalized relative path`);
  }

  return normalized;
}

function assertOpen(closed: boolean): void {
  if (closed) {
    throw new Error("SQLite runtime is closed");
  }
}
