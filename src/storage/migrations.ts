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
  },
  {
    version: 9,
    sql: `
      ALTER TABLE finding_lineage ADD COLUMN retrieval_metadata_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE finding_lineage ADD COLUMN policy_evaluation_id TEXT;
      ALTER TABLE finding_lineage ADD COLUMN proposal_source_id TEXT;
    `
  },
  {
    version: 10,
    sql: `
      ALTER TABLE proposals ADD COLUMN proposal_digest TEXT NOT NULL DEFAULT '';
      ALTER TABLE approvals ADD COLUMN proposal_digest TEXT;
    `
  },
  {
    version: 11,
    sql: `
      ALTER TABLE reviewer_feedback ADD COLUMN pattern_key TEXT NOT NULL DEFAULT '';
      CREATE INDEX reviewer_feedback_pattern_idx ON reviewer_feedback (pattern_key);
    `
  },
  {
    version: 12,
    sql: `
      ALTER TABLE scans ADD COLUMN identity_profile_hash TEXT NOT NULL DEFAULT 'legacy';
      CREATE TABLE note_subjects(
        subject_id TEXT PRIMARY KEY,
        current_path TEXT UNIQUE,
        created_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE TABLE note_path_history(
        subject_id TEXT NOT NULL REFERENCES note_subjects(subject_id),
        path TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        retired_at TEXT,
        PRIMARY KEY(subject_id, path, observed_at)
      );
      CREATE TABLE finding_identities(
        stable_key TEXT PRIMARY KEY,
        identity_version INTEGER NOT NULL,
        family TEXT NOT NULL,
        subtype TEXT NOT NULL,
        detector_id TEXT NOT NULL,
        detector_version TEXT NOT NULL,
        policy_id TEXT,
        policy_version TEXT,
        subject_ids_json TEXT NOT NULL,
        semantic_key TEXT NOT NULL
      );
      CREATE TABLE finding_occurrences(
        occurrence_id TEXT PRIMARY KEY,
        stable_key TEXT NOT NULL REFERENCES finding_identities(stable_key),
        finding_id TEXT NOT NULL UNIQUE REFERENCES findings(id),
        scan_id TEXT NOT NULL REFERENCES scans(id),
        evidence_revision_key TEXT NOT NULL,
        identity_version INTEGER NOT NULL,
        UNIQUE(stable_key, scan_id, evidence_revision_key)
      );
      CREATE TABLE review_dispositions(
        id TEXT PRIMARY KEY,
        stable_key TEXT NOT NULL,
        source_occurrence_id TEXT NOT NULL,
        source_evidence_revision_key TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('acknowledged','ignored','snoozed','expected','restored')),
        reason TEXT,
        created_at TEXT NOT NULL,
        until_at TEXT,
        until_evidence_changes INTEGER NOT NULL CHECK(until_evidence_changes IN (0,1)),
        restores_disposition_id TEXT
      );
      CREATE TABLE integrity_events(
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        schema_version INTEGER NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('audit','review','operational')),
        kind TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        scan_id TEXT,
        stable_key TEXT,
        occurrence_id TEXT,
        proposal_id TEXT,
        approval_id TEXT,
        safe_metadata_json TEXT NOT NULL
      );
      CREATE TABLE integrity_retention_settings(
        id INTEGER PRIMARY KEY CHECK(id = 1),
        operational_days INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE retention_deletions(
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        category TEXT NOT NULL,
        reason TEXT NOT NULL,
        deleted_count INTEGER NOT NULL,
        range_start TEXT,
        range_end TEXT
      );
      INSERT INTO integrity_retention_settings (id, operational_days, updated_at) VALUES (1, 180, '2026-09-28T00:00:00.000Z');
      CREATE INDEX finding_occurrences_scan_idx ON finding_occurrences (scan_id);
      CREATE INDEX finding_occurrences_stable_key_idx ON finding_occurrences (stable_key);
      CREATE INDEX integrity_events_category_occurred_idx ON integrity_events (category, occurred_at);
      CREATE INDEX integrity_events_scan_idx ON integrity_events (scan_id);
      CREATE INDEX integrity_events_stable_key_idx ON integrity_events (stable_key);
      CREATE INDEX integrity_events_occurrence_idx ON integrity_events (occurrence_id);
      CREATE INDEX integrity_events_proposal_idx ON integrity_events (proposal_id);
      CREATE INDEX integrity_events_approval_idx ON integrity_events (approval_id);
      CREATE INDEX review_dispositions_stable_key_created_idx ON review_dispositions (stable_key, created_at);
      CREATE INDEX note_path_history_subject_idx ON note_path_history (subject_id);
      CREATE INDEX note_path_history_path_idx ON note_path_history (path);
    `
  }
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

export function applyMigrations(
  database: Database,
  migrations: readonly Migration[] = MIGRATIONS
): number {
  let previousVersion = 0;
  for (const migration of migrations) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1) {
      throw new Error("migration versions must be positive safe integers");
    }
    if (migration.version <= previousVersion) {
      throw new Error("migration versions must be strictly increasing without duplicates");
    }
    previousVersion = migration.version;
  }

  database.run("PRAGMA foreign_keys = ON");
  database.run(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const appliedVersions = (
    database.exec("SELECT version FROM schema_migrations ORDER BY version")[0]?.values ?? []
  ).flatMap(([version]) => (typeof version === "number" ? [version] : []));

  for (const [index, version] of appliedVersions.entries()) {
    if (migrations[index]?.version !== version) {
      throw new Error("applied migrations are not a prefix of the supplied migration sequence");
    }
  }

  const applied = new Set(appliedVersions);
  for (const migration of migrations) {
    if (applied.has(migration.version)) {
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
