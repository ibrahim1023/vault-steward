import type { Database } from "sql.js";
import type {
  EvidenceRef,
  Finding,
  FindingSeverity,
  FindingStatus,
  FindingType
} from "../contracts/index.js";

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

export type ParseProduct = {
  path: string;
  revisionHash: string;
  frontmatterHash: string;
  bodyMetadataHash: string;
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

export type FindingQuery = {
  scanId?: string;
  type?: FindingType;
  severity?: FindingSeverity;
  status?: FindingStatus;
  policyId?: string;
  minimumConfidence?: number;
};

export type ScanHistoryRecord = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
};
export type FindingLifecycleRecord = {
  type: string;
  evidenceJson: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
};

export function hydrateFinding(record: FindingRecord): Finding | null {
  try {
    const evidence = JSON.parse(record.evidenceJson) as unknown;
    const payload = JSON.parse(record.payloadJson) as Record<string, unknown>;
    if (
      !Array.isArray(evidence) ||
      !evidence.every(isEvidence) ||
      typeof payload.confidence !== "number" ||
      typeof payload.explanation !== "string"
    )
      return null;
    return {
      schemaVersion: 1,
      id: record.id,
      scanId: record.scanId,
      type: record.type as FindingType,
      severity: record.severity as FindingSeverity,
      evidence,
      affectedNoteIds: [...new Set(evidence.map((item) => item.notePath))],
      ...(typeof payload.violatedPolicyId === "string"
        ? { violatedPolicyId: payload.violatedPolicyId }
        : {}),
      explanation: payload.explanation,
      suggestedFixes: [],
      confidence: payload.confidence,
      status: record.status as FindingStatus
    };
  } catch {
    return null;
  }
}

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

  saveParseProducts(
    scanId: string,
    parserVersion: string,
    products: readonly ParseProduct[]
  ): void {
    for (const product of products) {
      this.database.run(
        "INSERT INTO parse_products (scan_id, parser_version, path, revision_hash, frontmatter_hash, body_metadata_hash) VALUES (?, ?, ?, ?, ?, ?)",
        [
          scanId,
          parserVersion,
          product.path,
          product.revisionHash,
          product.frontmatterHash,
          product.bodyMetadataHash
        ]
      );
    }
  }

  getReusableParseProducts(input: {
    parserVersion: string;
    files: readonly Pick<ParseProduct, "path" | "revisionHash">[];
  }): ParseProduct[] {
    return input.files.flatMap((file) => {
      const row = this.database.exec(
        "SELECT path, revision_hash, frontmatter_hash, body_metadata_hash FROM parse_products WHERE parser_version = ? AND path = ? AND revision_hash = ? ORDER BY rowid DESC LIMIT 1",
        [input.parserVersion, file.path, file.revisionHash]
      )[0]?.values[0];
      return row && row.every((value) => typeof value === "string")
        ? [
            {
              path: row[0] as string,
              revisionHash: row[1] as string,
              frontmatterHash: row[2] as string,
              bodyMetadataHash: row[3] as string
            }
          ]
        : [];
    });
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

  listFindings(query: FindingQuery = {}): FindingRecord[] {
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (query.scanId) {
      clauses.push("scan_id = ?");
      parameters.push(query.scanId);
    }
    if (query.type) {
      clauses.push("type = ?");
      parameters.push(query.type);
    }
    if (query.severity) {
      clauses.push("severity = ?");
      parameters.push(query.severity);
    }
    if (query.status) {
      clauses.push("status = ?");
      parameters.push(query.status);
    }
    const statement = `SELECT id, scan_id, type, severity, status, evidence_json, payload_json FROM findings${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY id`;
    const rows = this.database.exec(statement, parameters)[0];
    const findings = (rows?.values ?? []).flatMap((row) => {
      const [id, scanId, type, severity, status, evidenceJson, payloadJson] = row;
      if (
        typeof id !== "string" ||
        typeof scanId !== "string" ||
        typeof type !== "string" ||
        typeof severity !== "string" ||
        typeof status !== "string" ||
        typeof evidenceJson !== "string" ||
        typeof payloadJson !== "string"
      )
        return [];
      const payload = parsePayload(payloadJson);
      if (
        (query.policyId && payload.violatedPolicyId !== query.policyId) ||
        (query.minimumConfidence !== undefined && payload.confidence < query.minimumConfidence)
      )
        return [];
      return [{ id, scanId, type, severity, status, evidenceJson, payloadJson }];
    });
    return findings;
  }

  listScanHistory(limit: number): ScanHistoryRecord[] {
    const capped = Math.max(1, Math.min(limit, 100));
    return (
      this.database.exec(
        "SELECT id, started_at, finished_at, status FROM scans ORDER BY started_at DESC LIMIT ?",
        [capped]
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" &&
      typeof row[1] === "string" &&
      typeof row[3] === "string" &&
      (typeof row[2] === "string" || row[2] === null)
        ? [{ id: row[0], startedAt: row[1], finishedAt: row[2], status: row[3] }]
        : []
    );
  }

  listFindingLifecycle(): FindingLifecycleRecord[] {
    return (
      this.database.exec(
        "SELECT f.type, f.evidence_json, MIN(s.started_at), MAX(s.started_at), COUNT(*) FROM findings f JOIN scans s ON s.id = f.scan_id GROUP BY f.type, f.evidence_json"
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" &&
      typeof row[1] === "string" &&
      typeof row[2] === "string" &&
      typeof row[3] === "string" &&
      typeof row[4] === "number"
        ? [
            {
              type: row[0],
              evidenceJson: row[1],
              firstSeen: row[2],
              lastSeen: row[3],
              occurrences: row[4]
            }
          ]
        : []
    );
  }

  saveProposal(record: ProposalRecord): void {
    this.database.run(
      "INSERT INTO proposals (id, finding_id, patch_json, source_revisions_json, status) VALUES (?, ?, ?, ?, ?)",
      [record.id, record.findingId, record.patchJson, record.sourceRevisionsJson, record.status]
    );
  }

  findProposal(id: string): ProposalRecord | null {
    const row = this.database.exec(
      "SELECT id, finding_id, patch_json, source_revisions_json, status FROM proposals WHERE id = ?",
      [id]
    )[0]?.values[0];
    return row && row.every((value) => typeof value === "string")
      ? {
          id: row[0] as string,
          findingId: row[1] as string,
          patchJson: row[2] as string,
          sourceRevisionsJson: row[3] as string,
          status: row[4] as string
        }
      : null;
  }

  updateProposalStatus(id: string, status: string): void {
    this.database.run("UPDATE proposals SET status = ? WHERE id = ?", [status, id]);
    if (this.database.getRowsModified() !== 1) throw new Error(`Unknown proposal ${id}`);
  }

  getProposalStatus(id: string): string | null {
    const value = this.database.exec("SELECT status FROM proposals WHERE id = ?", [id])[0]
      ?.values[0]?.[0];
    return typeof value === "string" ? value : null;
  }

  recoverInterruptedApplies(): number {
    this.database.run(
      "UPDATE proposals SET status = 'recovery-required' WHERE status IN ('applying', 'apply-failed')"
    );
    return this.database.getRowsModified();
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

function parsePayload(payloadJson: string): { confidence: number; violatedPolicyId?: string } {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    return {
      confidence: typeof payload.confidence === "number" ? payload.confidence : 0,
      ...(typeof payload.violatedPolicyId === "string"
        ? { violatedPolicyId: payload.violatedPolicyId }
        : {})
    };
  } catch {
    return { confidence: 0 };
  }
}

function isEvidence(value: unknown): value is EvidenceRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as EvidenceRef).notePath === "string" &&
    typeof (value as EvidenceRef).locator === "string" &&
    typeof (value as EvidenceRef).excerpt === "string"
  );
}
