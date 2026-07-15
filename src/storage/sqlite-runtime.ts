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
  if (
    options.databaseBytes &&
    options.databaseBytes.byteLength > 0 &&
    !isSqliteDatabase(options.databaseBytes)
  ) {
    throw new Error("local database bytes are corrupt");
  }
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

function isSqliteDatabase(bytes: Uint8Array): boolean {
  const header = new TextEncoder().encode("SQLite format 3\0");
  return (
    bytes.byteLength >= header.byteLength && header.every((value, index) => bytes[index] === value)
  );
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
