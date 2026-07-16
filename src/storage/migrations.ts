import type { Database } from "sql.js";

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE scans (
        id TEXT PRIMARY KEY,
        vault_fingerprint TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        config_hash TEXT NOT NULL
      );
    `
  },
  {
    version: 2,
    sql: `
      ALTER TABLE scans ADD COLUMN input_hash TEXT NOT NULL DEFAULT '';
      ALTER TABLE scans ADD COLUMN parser_version TEXT NOT NULL DEFAULT '';

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        path TEXT NOT NULL,
        revision_hash TEXT NOT NULL,
        frontmatter_json TEXT NOT NULL,
        body_metadata_json TEXT NOT NULL,
        UNIQUE (scan_id, path)
      );
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        kind TEXT NOT NULL,
        source_note_id TEXT REFERENCES notes(id),
        label TEXT NOT NULL
      );
      CREATE TABLE edges (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        from_node_id TEXT NOT NULL REFERENCES nodes(id),
        to_node_id TEXT NOT NULL REFERENCES nodes(id),
        relation TEXT NOT NULL,
        evidence_locator TEXT NOT NULL,
        UNIQUE (scan_id, from_node_id, to_node_id, relation, evidence_locator)
      );
      CREATE TABLE policies (
        id TEXT PRIMARY KEY,
        source_hash TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        schema_version INTEGER NOT NULL
      );
      CREATE TABLE findings (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
      CREATE TABLE proposals (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES findings(id),
        patch_json TEXT NOT NULL,
        source_revisions_json TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE approvals (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES proposals(id),
        action TEXT NOT NULL,
        acted_at TEXT NOT NULL,
        applied_revision TEXT
      );
      CREATE TABLE model_traces (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        request_metadata_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        outcome TEXT NOT NULL
      );
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE scan_inputs (
        scan_id TEXT NOT NULL REFERENCES scans(id),
        path TEXT NOT NULL,
        revision_hash TEXT NOT NULL,
        PRIMARY KEY (scan_id, path)
      );
      CREATE INDEX scans_reusable_snapshot_idx
        ON scans (vault_fingerprint, input_hash, parser_version, status);
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE parse_products (
        scan_id TEXT NOT NULL REFERENCES scans(id),
        parser_version TEXT NOT NULL,
        path TEXT NOT NULL,
        revision_hash TEXT NOT NULL,
        frontmatter_hash TEXT NOT NULL,
        body_metadata_hash TEXT NOT NULL,
        PRIMARY KEY (scan_id, path)
      );
      CREATE INDEX parse_products_reuse_idx
        ON parse_products (parser_version, path, revision_hash);
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE parse_dependencies (
        scan_id TEXT NOT NULL REFERENCES scans(id),
        path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        relation TEXT NOT NULL,
        PRIMARY KEY (scan_id, path, target_path, relation)
      );
      CREATE INDEX parse_dependencies_target_idx
        ON parse_dependencies (target_path);
    `
  },
  {
    version: 6,
    sql: `
      CREATE TABLE reviewer_feedback (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES findings(id),
        proposal_id TEXT,
        verdict TEXT NOT NULL CHECK (verdict IN ('false-positive', 'useful', 'needs-review')),
        label TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX reviewer_feedback_finding_idx ON reviewer_feedback (finding_id);
    `
  },
  {
    version: 7,
    sql: `
      CREATE TABLE trace_spans (id TEXT PRIMARY KEY, scan_id TEXT NOT NULL REFERENCES scans(id), parent_span_id TEXT, kind TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, outcome TEXT NOT NULL, correlation_id TEXT NOT NULL, attributes_json TEXT NOT NULL, schema_version INTEGER NOT NULL);
      CREATE TABLE agent_executions (id TEXT PRIMARY KEY, scan_id TEXT NOT NULL REFERENCES scans(id), span_id TEXT NOT NULL REFERENCES trace_spans(id), agent TEXT NOT NULL, model TEXT NOT NULL, duration_ms INTEGER NOT NULL, retry_count INTEGER NOT NULL, validation TEXT NOT NULL, correlation_id TEXT NOT NULL, schema_version INTEGER NOT NULL);
      CREATE TABLE finding_lineage (finding_id TEXT PRIMARY KEY REFERENCES findings(id), scan_id TEXT NOT NULL REFERENCES scans(id), evidence_locators_json TEXT NOT NULL, parsed_artifact_ids_json TEXT NOT NULL, validator_id TEXT NOT NULL, coordinator_decision_id TEXT NOT NULL, agent_execution_id TEXT, correlation_id TEXT NOT NULL, schema_version INTEGER NOT NULL);
      CREATE TABLE telemetry_settings (id INTEGER PRIMARY KEY CHECK (id = 1), retention_days INTEGER NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO telemetry_settings (id, retention_days, updated_at) VALUES (1, 30, CURRENT_TIMESTAMP);
      CREATE TABLE telemetry_deletions (id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL, category TEXT NOT NULL, scan_id TEXT);
    `
  },
  {
    version: 8,
    sql: `
      ALTER TABLE telemetry_settings ADD COLUMN store_prompt_snapshots INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE telemetry_settings ADD COLUMN store_model_output_snapshots INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE telemetry_settings ADD COLUMN redact_excerpts INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE telemetry_settings ADD COLUMN excluded_folders_json TEXT NOT NULL DEFAULT '[]';
      CREATE TABLE trace_configurations (
        scan_id TEXT PRIMARY KEY REFERENCES scans(id),
        fingerprint TEXT NOT NULL,
        values_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL
      );
      CREATE TABLE trace_snapshots (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL REFERENCES scans(id),
        category TEXT NOT NULL CHECK (category IN ('prompt', 'model-output')),
        snapshot_json TEXT NOT NULL,
        byte_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX trace_spans_scan_started_idx ON trace_spans (scan_id, started_at);
      CREATE INDEX trace_snapshots_scan_category_idx ON trace_snapshots (scan_id, category);
    `
  }
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

export function applyMigrations(
  database: Database,
  migrations: readonly Migration[] = MIGRATIONS
): number {
  database.run("PRAGMA foreign_keys = ON");
  database.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const appliedVersions = new Set(
    database.exec("SELECT version FROM schema_migrations")[0]?.values.map(([version]) => version)
  );

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    database.run("BEGIN IMMEDIATE");
    try {
      database.run(migration.sql);
      database.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        migration.version,
        new Date().toISOString()
      ]);
      database.run("COMMIT");
    } catch (error) {
      database.run("ROLLBACK");
      throw error;
    }
  }

  return migrations.at(-1)?.version ?? 0;
}
