import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import {
  applyMigrations,
  LATEST_SCHEMA_VERSION,
  MIGRATIONS
} from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

async function createDatabase() {
  const sql = await initSqlJs({
    locateFile: (file) => `node_modules/sql.js/dist/${file}`
  });
  return new sql.Database();
}

describe("SQLite migrations and repositories", () => {
  it("creates the canonical schema for an empty install", async () => {
    const database = await createDatabase();

    expect(applyMigrations(database)).toBe(LATEST_SCHEMA_VERSION);
    expect(
      database
        .exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]
        ?.values.flat()
    ).toEqual(
      expect.arrayContaining([
        "approvals",
        "edges",
        "findings",
        "model_traces",
        "nodes",
        "notes",
        "policies",
        "proposals",
        "reviewer_feedback",
        "scans",
        "schema_migrations"
      ])
    );
  });

  it("upgrades a populated version-one database without losing its scan", async () => {
    const database = await createDatabase();
    database.run(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);"
    );
    database.run(
      "CREATE TABLE scans (id TEXT PRIMARY KEY, vault_fingerprint TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, config_hash TEXT NOT NULL);"
    );
    database.run("INSERT INTO schema_migrations VALUES (1, '2026-07-13T00:00:00.000Z')");
    database.run(
      "INSERT INTO scans VALUES ('scan-1', 'vault-1', '2026-07-13T00:00:00.000Z', NULL, 'running', 'config-1')"
    );

    expect(applyMigrations(database)).toBe(LATEST_SCHEMA_VERSION);
    expect(database.exec("SELECT id, input_hash, parser_version FROM scans")).toEqual([
      { columns: ["id", "input_hash", "parser_version"], values: [["scan-1", "", ""]] }
    ]);
  });

  it("rolls back a failed migration and leaves its version unapplied", async () => {
    const database = await createDatabase();

    expect(() =>
      applyMigrations(database, [
        {
          version: 1,
          sql: "CREATE TABLE healthy (id TEXT PRIMARY KEY);"
        },
        {
          version: 2,
          sql: "CREATE TABLE broken (id TEXT PRIMARY KEY); THIS IS NOT SQL;"
        }
      ])
    ).toThrow();
    expect(database.exec("SELECT name FROM sqlite_master WHERE name = 'broken'")).toEqual([]);
    expect(database.exec("SELECT version FROM schema_migrations ORDER BY version")).toEqual([
      { columns: ["version"], values: [[1]] }
    ]);

    expect(
      applyMigrations(database, [
        { version: 1, sql: "CREATE TABLE healthy (id TEXT PRIMARY KEY);" },
        { version: 2, sql: "CREATE TABLE recovered (id TEXT PRIMARY KEY);" }
      ])
    ).toBe(2);
    expect(database.exec("SELECT name FROM sqlite_master WHERE name = 'recovered'")).toEqual([
      { columns: ["name"], values: [["recovered"]] }
    ]);
  });

  it("creates the maintenance storage schema and seeds retention settings", async () => {
    const database = await createDatabase();

    expect(applyMigrations(database)).toBe(LATEST_SCHEMA_VERSION);
    expect(LATEST_SCHEMA_VERSION).toBe(12);
    expect(
      database
        .exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]
        ?.values.flat()
    ).toEqual(
      expect.arrayContaining([
        "finding_identities",
        "finding_occurrences",
        "integrity_events",
        "integrity_retention_settings",
        "note_path_history",
        "note_subjects",
        "retention_deletions",
        "review_dispositions"
      ])
    );

    const scanColumns = database.exec("PRAGMA table_info(scans)")[0]?.values ?? [];
    const profileColumn = scanColumns.find((column) => column[1] === "identity_profile_hash");
    expect(profileColumn?.[4]).toBe("'legacy'");

    expect(
      database.exec("SELECT name FROM sqlite_master WHERE type = 'index'")[0]?.values.flat()
    ).toEqual(
      expect.arrayContaining([
        "finding_occurrences_scan_idx",
        "finding_occurrences_stable_key_idx",
        "integrity_events_category_occurred_idx",
        "integrity_events_scan_idx",
        "integrity_events_stable_key_idx",
        "integrity_events_occurrence_idx",
        "integrity_events_proposal_idx",
        "integrity_events_approval_idx",
        "review_dispositions_stable_key_created_idx",
        "note_path_history_subject_idx",
        "note_path_history_path_idx"
      ])
    );

    expect(
      database.exec("SELECT operational_days, updated_at FROM integrity_retention_settings")
    ).toEqual([
      {
        columns: ["operational_days", "updated_at"],
        values: [[180, "2026-09-28T00:00:00.000Z"]]
      }
    ]);
  });

  it("upgrades a populated version-eleven database preserving rows and profile defaults", async () => {
    const database = await createDatabase();
    const throughEleven = MIGRATIONS.filter((migration) => migration.version <= 11);
    expect(applyMigrations(database, throughEleven)).toBe(11);
    database.run(
      "INSERT INTO scans (id, vault_fingerprint, started_at, finished_at, status, config_hash, input_hash, parser_version) VALUES ('scan-legacy', 'vault', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:01.000Z', 'completed', 'config', 'input', 'parser')"
    );
    database.run(
      "INSERT INTO findings (id, scan_id, type, severity, status, evidence_json, payload_json) VALUES ('finding-legacy', 'scan-legacy', 'broken-reference', 'medium', 'open', '[]', '{}')"
    );

    expect(applyMigrations(database)).toBe(12);
    expect(database.exec("SELECT id, identity_profile_hash FROM scans")).toEqual([
      { columns: ["id", "identity_profile_hash"], values: [["scan-legacy", "legacy"]] }
    ]);
    expect(database.exec("SELECT id FROM findings")).toEqual([
      { columns: ["id"], values: [["finding-legacy"]] }
    ]);
  });

  it("rejects reversed, duplicate, and invalid migration versions before mutating", async () => {
    const database = await createDatabase();
    const healthy = { version: 1, sql: "CREATE TABLE healthy (id TEXT PRIMARY KEY);" };

    expect(() => applyMigrations(database, [{ version: 2, sql: healthy.sql }, healthy])).toThrow();
    expect(() => applyMigrations(database, [healthy, healthy])).toThrow();
    expect(() => applyMigrations(database, [{ version: 0, sql: healthy.sql }])).toThrow();
    expect(() => applyMigrations(database, [{ version: 1.5, sql: healthy.sql }])).toThrow();
    expect(database.exec("SELECT name FROM sqlite_master")).toEqual([]);
  });

  it("rejects applied versions missing from or gapped against supplied migrations", async () => {
    const createAppliedDatabase = async (versions: readonly number[]) => {
      const database = await createDatabase();
      database.run(
        "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
      );
      for (const version of versions) {
        database.run("INSERT INTO schema_migrations VALUES (?, ?)", [
          version,
          "2026-01-01T00:00:00.000Z"
        ]);
      }
      return database;
    };

    const unknownForward = await createAppliedDatabase([1, 99]);
    expect(() => applyMigrations(unknownForward)).toThrow();
    expect(
      unknownForward.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scans'")
    ).toEqual([]);

    const gapped = await createAppliedDatabase([1, 3]);
    expect(() => applyMigrations(gapped)).toThrow();

    const nonPrefix = await createAppliedDatabase([2]);
    expect(() => applyMigrations(nonPrefix)).toThrow();
  });

  it("persists every canonical record through a typed repository", async () => {
    const database = await createDatabase();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);

    repository.saveScan({
      id: "scan-1",
      vaultFingerprint: "vault-1",
      startedAt: "2026-07-13T00:00:00.000Z",
      finishedAt: null,
      status: "running",
      configHash: "config-1",
      inputHash: "input-1",
      parserVersion: "parser-1"
    });
    repository.saveNote({
      id: "note-1",
      scanId: "scan-1",
      path: "Home.md",
      revisionHash: "revision-1",
      frontmatterJson: "{}",
      bodyMetadataJson: "{}"
    });
    repository.saveNode({
      id: "node-1",
      scanId: "scan-1",
      kind: "note",
      sourceNoteId: "note-1",
      label: "Home"
    });
    repository.saveEdge({
      id: "edge-1",
      scanId: "scan-1",
      fromNodeId: "node-1",
      toNodeId: "node-1",
      relation: "references",
      evidenceLocator: "Home.md:1"
    });
    repository.savePolicy({
      id: "policy-1",
      sourceHash: "policy-hash",
      enabled: true,
      schemaVersion: 1
    });
    repository.saveFinding({
      id: "finding-1",
      scanId: "scan-1",
      type: "broken-reference",
      severity: "medium",
      status: "open",
      evidenceJson: "[]",
      payloadJson: "{}"
    });
    repository.saveProposal({
      id: "proposal-1",
      findingId: "finding-1",
      patchJson: JSON.stringify({
        schemaVersion: 1,
        id: "proposal-1",
        findingId: "finding-1",
        scanId: "scan-1",
        explanation: "Repair the broken reference.",
        operations: [
          {
            kind: "replace-range",
            path: "Home.md",
            sourceRevision: "revision-1",
            start: 0,
            end: 1,
            expected: "x",
            replacement: "y"
          }
        ]
      }),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
    repository.recordApproval({
      id: "approval-1",
      proposalId: "proposal-1",
      action: "approved",
      actedAt: "2026-07-13T00:01:00.000Z",
      appliedRevision: null
    });
    repository.saveModelTrace({
      id: "trace-1",
      scanId: "scan-1",
      requestMetadataJson: "{}",
      schemaVersion: 1,
      durationMs: 12,
      inputTokens: 3,
      outputTokens: 4,
      outcome: "success"
    });

    expect(repository.getRecordCounts()).toEqual({
      approvals: 1,
      edges: 1,
      findings: 1,
      modelTraces: 1,
      nodes: 1,
      notes: 1,
      policies: 1,
      proposals: 1,
      reviewerFeedback: 0,
      scans: 1
    });
  });
});
