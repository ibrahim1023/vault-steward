import type { Database } from "sql.js";

export type ScanRecord = {
  id: string;
  vaultFingerprint: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  configHash: string;
  inputHash: string;
  parserVersion: string;
};

export type NoteRecord = {
  id: string;
  scanId: string;
  path: string;
  revisionHash: string;
  frontmatterJson: string;
  bodyMetadataJson: string;
};

export type NodeRecord = {
  id: string;
  scanId: string;
  kind: string;
  sourceNoteId: string | null;
  label: string;
};

export type EdgeRecord = {
  id: string;
  scanId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  evidenceLocator: string;
};

export type PolicyRecord = {
  id: string;
  sourceHash: string;
  enabled: boolean;
  schemaVersion: number;
};

export type FindingRecord = {
  id: string;
  scanId: string;
  type: string;
  severity: string;
  status: string;
  evidenceJson: string;
  payloadJson: string;
};

export type ProposalRecord = {
  id: string;
  findingId: string;
  patchJson: string;
  sourceRevisionsJson: string;
  status: string;
};

export type ApprovalRecord = {
  id: string;
  proposalId: string;
  action: string;
  actedAt: string;
  appliedRevision: string | null;
};

export type ModelTraceRecord = {
  id: string;
  scanId: string;
  requestMetadataJson: string;
  schemaVersion: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  outcome: string;
};

export class VaultStewardRepository {
  constructor(private readonly database: Database) {}

  saveScan(record: ScanRecord): void {
    this.database.run(
      "INSERT INTO scans (id, vault_fingerprint, started_at, finished_at, status, config_hash, input_hash, parser_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.vaultFingerprint,
        record.startedAt,
        record.finishedAt,
        record.status,
        record.configHash,
        record.inputHash,
        record.parserVersion
      ]
    );
  }

  saveNote(record: NoteRecord): void {
    this.database.run(
      "INSERT INTO notes (id, scan_id, path, revision_hash, frontmatter_json, body_metadata_json) VALUES (?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.scanId,
        record.path,
        record.revisionHash,
        record.frontmatterJson,
        record.bodyMetadataJson
      ]
    );
  }

  saveNode(record: NodeRecord): void {
    this.database.run(
      "INSERT INTO nodes (id, scan_id, kind, source_note_id, label) VALUES (?, ?, ?, ?, ?)",
      [record.id, record.scanId, record.kind, record.sourceNoteId, record.label]
    );
  }

  saveEdge(record: EdgeRecord): void {
    this.database.run(
      "INSERT INTO edges (id, scan_id, from_node_id, to_node_id, relation, evidence_locator) VALUES (?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.scanId,
        record.fromNodeId,
        record.toNodeId,
        record.relation,
        record.evidenceLocator
      ]
    );
  }

  savePolicy(record: PolicyRecord): void {
    this.database.run(
      "INSERT INTO policies (id, source_hash, enabled, schema_version) VALUES (?, ?, ?, ?)",
      [record.id, record.sourceHash, Number(record.enabled), record.schemaVersion]
    );
  }

  saveFinding(record: FindingRecord): void {
    this.database.run(
      "INSERT INTO findings (id, scan_id, type, severity, status, evidence_json, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.scanId,
        record.type,
        record.severity,
        record.status,
        record.evidenceJson,
        record.payloadJson
      ]
    );
  }

  saveProposal(record: ProposalRecord): void {
    this.database.run(
      "INSERT INTO proposals (id, finding_id, patch_json, source_revisions_json, status) VALUES (?, ?, ?, ?, ?)",
      [record.id, record.findingId, record.patchJson, record.sourceRevisionsJson, record.status]
    );
  }

  recordApproval(record: ApprovalRecord): void {
    this.database.run(
      "INSERT INTO approvals (id, proposal_id, action, acted_at, applied_revision) VALUES (?, ?, ?, ?, ?)",
      [record.id, record.proposalId, record.action, record.actedAt, record.appliedRevision]
    );
  }

  saveModelTrace(record: ModelTraceRecord): void {
    this.database.run(
      "INSERT INTO model_traces (id, scan_id, request_metadata_json, schema_version, duration_ms, input_tokens, output_tokens, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.scanId,
        record.requestMetadataJson,
        record.schemaVersion,
        record.durationMs,
        record.inputTokens,
        record.outputTokens,
        record.outcome
      ]
    );
  }

  getRecordCounts(): RecordCounts {
    return {
      approvals: countRows(this.database, "approvals"),
      edges: countRows(this.database, "edges"),
      findings: countRows(this.database, "findings"),
      modelTraces: countRows(this.database, "model_traces"),
      nodes: countRows(this.database, "nodes"),
      notes: countRows(this.database, "notes"),
      policies: countRows(this.database, "policies"),
      proposals: countRows(this.database, "proposals"),
      scans: countRows(this.database, "scans")
    };
  }
}

export type RecordCounts = {
  approvals: number;
  edges: number;
  findings: number;
  modelTraces: number;
  nodes: number;
  notes: number;
  policies: number;
  proposals: number;
  scans: number;
};

function countRows(database: Database, tableName: string): number {
  const value = database.exec(`SELECT COUNT(*) AS count FROM ${tableName}`)[0]?.values[0]?.[0];
  return typeof value === "number" ? value : 0;
}
