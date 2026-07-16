import type { Database } from "sql.js";
import type {
  EvidenceRef,
  Finding,
  FindingSeverity,
  FindingStatus,
  FindingType
} from "../contracts/index.js";
import {
  type AgentExecutionTrace,
  type FindingLineage,
  type TracePreferences,
  type TraceSpan,
  validateTraceMetadata,
  validateTracePreferences
} from "../contracts/trace.js";

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
  dependencies: readonly { targetPath: string; relation: string }[];
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
  resolved: boolean;
  stale: boolean;
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

export type ReviewerFeedbackRecord = {
  id: string;
  findingId: string;
  proposalId: string | null;
  verdict: "false-positive" | "useful" | "needs-review";
  label: string | null;
  createdAt: string;
};

export type TraceTimelineEntry = {
  id: string;
  kind: string;
  startedAt: string;
  completedAt: string | null;
  outcome: "success" | "failure";
  durationMs: number | null;
  retryCount: number;
  fileCount: number | null;
  errorCode: string | null;
};

export type FindingLineageView = {
  findingId: string;
  evidenceLocators: string[];
  parsedArtifactIds: string[];
  validatorId: string;
  coordinatorDecisionId: string;
  agentExecutionId: string | null;
};

export type TraceConfigurationRecord = {
  fingerprint: string;
  values: Record<string, string | number | boolean>;
};

export type TraceInventory = {
  spans: number;
  agentExecutions: number;
  findingLineage: number;
  retentionDays: number;
  categories: {
    promptSnapshots: { enabled: boolean; count: number; bytes: number };
    modelOutputSnapshots: { enabled: boolean; count: number; bytes: number };
  };
};

export type ObservabilitySnapshot = {
  scanId: string | null;
  timeline: TraceTimelineEntry[];
  lineage: FindingLineageView[];
  configuration: TraceConfigurationRecord | null;
  inventory: TraceInventory;
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
      for (const dependency of product.dependencies) {
        this.database.run(
          "INSERT OR IGNORE INTO parse_dependencies (scan_id, path, target_path, relation) VALUES (?, ?, ?, ?)",
          [scanId, product.path, dependency.targetPath, dependency.relation]
        );
      }
    }
  }

  getReusableParseProducts(input: {
    parserVersion: string;
    files: readonly Pick<ParseProduct, "path" | "revisionHash">[];
  }): ParseProduct[] {
    return input.files.flatMap((file) => {
      const row = this.database.exec(
        "SELECT scan_id, path, revision_hash, frontmatter_hash, body_metadata_hash FROM parse_products WHERE parser_version = ? AND path = ? AND revision_hash = ? ORDER BY rowid DESC LIMIT 1",
        [input.parserVersion, file.path, file.revisionHash]
      )[0]?.values[0];
      return row && row.every((value) => typeof value === "string")
        ? [
            {
              path: row[1] as string,
              revisionHash: row[2] as string,
              frontmatterHash: row[3] as string,
              bodyMetadataHash: row[4] as string,
              dependencies: this.getParseDependencies(row[0] as string, row[1] as string)
            }
          ]
        : [];
    });
  }

  private getParseDependencies(scanId: string, path: string): ParseProduct["dependencies"] {
    return (
      this.database.exec(
        "SELECT target_path, relation FROM parse_dependencies WHERE scan_id = ? AND path = ? ORDER BY target_path, relation",
        [scanId, path]
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" && typeof row[1] === "string"
        ? [{ targetPath: row[0], relation: row[1] }]
        : []
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

  latestCompletedScanId(): string | null {
    const id = this.database.exec(
      "SELECT id FROM scans WHERE status = 'completed' ORDER BY finished_at DESC, started_at DESC LIMIT 1"
    )[0]?.values[0]?.[0];
    return typeof id === "string" ? id : null;
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
    const latestCompletedScan = this.database.exec(
      "SELECT MAX(started_at) FROM scans WHERE status = 'completed'"
    )[0]?.values[0]?.[0];
    return (
      this.database.exec(
        "SELECT f.type, f.evidence_json, MIN(s.started_at), MAX(s.started_at), COUNT(*), MAX(CASE WHEN f.status = 'stale' THEN 1 ELSE 0 END) FROM findings f JOIN scans s ON s.id = f.scan_id WHERE s.status = 'completed' GROUP BY f.type, f.evidence_json"
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" &&
      typeof row[1] === "string" &&
      typeof row[2] === "string" &&
      typeof row[3] === "string" &&
      typeof row[4] === "number" &&
      typeof row[5] === "number"
        ? [
            {
              type: row[0],
              evidenceJson: row[1],
              firstSeen: row[2],
              lastSeen: row[3],
              occurrences: row[4],
              resolved: typeof latestCompletedScan === "string" && row[3] < latestCompletedScan,
              stale: row[5] === 1
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

  saveTraceSpan(span: TraceSpan): void {
    this.database.run(
      "INSERT INTO trace_spans (id, scan_id, parent_span_id, kind, started_at, completed_at, outcome, correlation_id, attributes_json, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        span.id,
        span.scanId,
        span.parentSpanId ?? null,
        span.kind,
        span.startedAt,
        span.completedAt ?? null,
        span.outcome,
        span.correlationId,
        JSON.stringify(span.attributes),
        span.schemaVersion
      ]
    );
  }

  saveAgentExecution(execution: AgentExecutionTrace): void {
    this.database.run(
      "INSERT INTO agent_executions (id, scan_id, span_id, agent, model, duration_ms, retry_count, validation, correlation_id, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        execution.id,
        execution.scanId,
        execution.spanId,
        execution.agent,
        execution.model,
        execution.durationMs,
        execution.retryCount,
        execution.validation,
        execution.correlationId,
        execution.schemaVersion
      ]
    );
  }

  saveFindingLineage(lineage: FindingLineage): void {
    this.database.run(
      "INSERT INTO finding_lineage (finding_id, scan_id, evidence_locators_json, parsed_artifact_ids_json, validator_id, coordinator_decision_id, agent_execution_id, correlation_id, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        lineage.findingId,
        lineage.scanId,
        JSON.stringify(lineage.evidenceLocators),
        JSON.stringify(lineage.parsedArtifactIds),
        lineage.validatorId,
        lineage.coordinatorDecisionId,
        lineage.agentExecutionId ?? null,
        lineage.correlationId,
        lineage.schemaVersion
      ]
    );
  }

  saveTraceConfiguration(input: {
    scanId: string;
    fingerprint: string;
    values: Record<string, string | number | boolean>;
  }): void {
    if (
      input.fingerprint.length !== 64 ||
      !/^[a-f0-9]+$/i.test(input.fingerprint) ||
      !validateTraceMetadata(input.values)
    )
      throw new Error("Trace configuration is invalid.");
    this.database.run(
      "INSERT INTO trace_configurations (scan_id, fingerprint, values_json, schema_version) VALUES (?, ?, ?, 1)",
      [input.scanId, input.fingerprint, JSON.stringify(input.values)]
    );
  }

  getTracePreferences(): TracePreferences {
    const row = this.database.exec(
      "SELECT retention_days, store_prompt_snapshots, store_model_output_snapshots, redact_excerpts, excluded_folders_json FROM telemetry_settings WHERE id = 1"
    )[0]?.values[0];
    const excludedFolders = typeof row?.[4] === "string" ? safeStringArray(row[4]) : [];
    const candidate: TracePreferences = {
      retentionDays: typeof row?.[0] === "number" ? row[0] : 30,
      storePromptSnapshots: row?.[1] === 1,
      storeModelOutputSnapshots: row?.[2] === 1,
      redactExcerpts: row?.[3] !== 0,
      excludedFolders
    };
    return validateTracePreferences(candidate) ? candidate : defaultTracePreferences();
  }

  setTracePreferences(preferences: TracePreferences, updatedAt: string): void {
    if (!validateTracePreferences(preferences)) throw new Error("Trace preferences are invalid.");
    this.database.run(
      "UPDATE telemetry_settings SET retention_days = ?, store_prompt_snapshots = ?, store_model_output_snapshots = ?, redact_excerpts = ?, excluded_folders_json = ?, updated_at = ? WHERE id = 1",
      [
        preferences.retentionDays,
        Number(preferences.storePromptSnapshots),
        Number(preferences.storeModelOutputSnapshots),
        Number(preferences.redactExcerpts),
        JSON.stringify(preferences.excludedFolders),
        updatedAt
      ]
    );
  }

  saveTraceSnapshot(scanId: string, category: "prompt" | "model-output", snapshot: string): void {
    if (snapshot.length === 0 || snapshot.length > 4_096 || !validateTraceMetadata(snapshot))
      throw new Error("Trace snapshot is invalid.");
    const preferences = this.getTracePreferences();
    if (
      (category === "prompt" && !preferences.storePromptSnapshots) ||
      (category === "model-output" && !preferences.storeModelOutputSnapshots)
    )
      throw new Error("Trace snapshots are disabled.");
    this.database.run(
      "INSERT INTO trace_snapshots (id, scan_id, category, snapshot_json, byte_count, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), scanId, category, snapshot, new TextEncoder().encode(snapshot).length, new Date().toISOString()]
    );
  }

  getObservabilitySnapshot(scanId?: string): ObservabilitySnapshot {
    const selectedScanId = scanId ?? this.latestCompletedScanId();
    const timeline = selectedScanId ? this.listTraceTimeline(selectedScanId) : [];
    const lineage = selectedScanId ? this.listFindingLineage(selectedScanId) : [];
    return {
      scanId: selectedScanId,
      timeline,
      lineage,
      configuration: selectedScanId ? this.getTraceConfiguration(selectedScanId) : null,
      inventory: this.getTraceInventory()
    };
  }

  private listTraceTimeline(scanId: string): TraceTimelineEntry[] {
    return (
      this.database.exec(
        "SELECT id, kind, started_at, completed_at, outcome, attributes_json FROM trace_spans WHERE scan_id = ? ORDER BY started_at, id",
        [scanId]
      )[0]?.values ?? []
    ).flatMap((row) => {
      const [id, kind, startedAt, completedAt, outcome, attributesJson] = row;
      const attributes = typeof attributesJson === "string" ? safeMetadata(attributesJson) : null;
      if (
        typeof id !== "string" ||
        typeof kind !== "string" ||
        typeof startedAt !== "string" ||
        (typeof completedAt !== "string" && completedAt !== null) ||
        (outcome !== "success" && outcome !== "failure") ||
        attributes === null
      )
        return [];
      return [
        {
          id,
          kind,
          startedAt,
          completedAt,
          outcome,
          durationMs: durationBetween(startedAt, completedAt),
          retryCount: numericAttribute(attributes, "retryCount"),
          fileCount: nullableNumericAttribute(attributes, "fileCount"),
          errorCode: stringAttribute(attributes, "errorCode")
        }
      ];
    });
  }

  private listFindingLineage(scanId: string): FindingLineageView[] {
    return (
      this.database.exec(
        "SELECT finding_id, evidence_locators_json, parsed_artifact_ids_json, validator_id, coordinator_decision_id, agent_execution_id FROM finding_lineage WHERE scan_id = ? ORDER BY finding_id",
        [scanId]
      )[0]?.values ?? []
    ).flatMap((row) => {
      const evidenceLocators = typeof row[1] === "string" ? safeStringArray(row[1]) : [];
      const parsedArtifactIds = typeof row[2] === "string" ? safeStringArray(row[2]) : [];
      return typeof row[0] === "string" &&
        evidenceLocators.length > 0 &&
        parsedArtifactIds.length > 0 &&
        typeof row[3] === "string" &&
        typeof row[4] === "string" &&
        (typeof row[5] === "string" || row[5] === null)
        ? [
            {
              findingId: row[0],
              evidenceLocators,
              parsedArtifactIds,
              validatorId: row[3],
              coordinatorDecisionId: row[4],
              agentExecutionId: row[5]
            }
          ]
        : [];
    });
  }

  private getTraceConfiguration(scanId: string): TraceConfigurationRecord | null {
    const row = this.database.exec(
      "SELECT fingerprint, values_json FROM trace_configurations WHERE scan_id = ?",
      [scanId]
    )[0]?.values[0];
    const values = typeof row?.[1] === "string" ? safeMetadata(row[1]) : null;
    return typeof row?.[0] === "string" && values !== null
      ? { fingerprint: row[0], values: values as Record<string, string | number | boolean> }
      : null;
  }

  deleteTraceForScan(scanId: string, deletedAt: string, id: string): void {
    this.database.run("DELETE FROM agent_executions WHERE scan_id = ?", [scanId]);
    this.database.run("DELETE FROM trace_spans WHERE scan_id = ?", [scanId]);
    this.database.run("DELETE FROM finding_lineage WHERE scan_id = ?", [scanId]);
    this.database.run(
      "INSERT INTO telemetry_deletions (id, deleted_at, category, scan_id) VALUES (?, ?, 'scan-traces', ?)",
      [id, deletedAt, scanId]
    );
  }

  getTraceInventory(): TraceInventory {
    const preferences = this.getTracePreferences();
    return {
      spans: countRows(this.database, "trace_spans"),
      agentExecutions: countRows(this.database, "agent_executions"),
      findingLineage: countRows(this.database, "finding_lineage"),
      retentionDays: preferences.retentionDays,
      categories: {
        promptSnapshots: this.snapshotInventory("prompt", preferences.storePromptSnapshots),
        modelOutputSnapshots: this.snapshotInventory(
          "model-output",
          preferences.storeModelOutputSnapshots
        )
      }
    };
  }

  private snapshotInventory(category: "prompt" | "model-output", enabled: boolean) {
    const row = this.database.exec(
      "SELECT COUNT(*), COALESCE(SUM(byte_count), 0) FROM trace_snapshots WHERE category = ?",
      [category]
    )[0]?.values[0];
    return {
      enabled,
      count: typeof row?.[0] === "number" ? row[0] : 0,
      bytes: typeof row?.[1] === "number" ? row[1] : 0
    };
  }

  setTraceRetention(days: number, updatedAt: string): void {
    this.setTracePreferences({ ...this.getTracePreferences(), retentionDays: days }, updatedAt);
  }

  deleteAllTraceData(deletedAt: string, id: string): void {
    this.database.run("DELETE FROM agent_executions");
    this.database.run("DELETE FROM trace_spans");
    this.database.run("DELETE FROM finding_lineage");
    this.database.run("DELETE FROM trace_configurations");
    this.database.run("DELETE FROM trace_snapshots");
    this.database.run(
      "INSERT INTO telemetry_deletions (id, deleted_at, category, scan_id) VALUES (?, ?, 'all-traces', NULL)",
      [id, deletedAt]
    );
  }

  saveReviewerFeedback(record: ReviewerFeedbackRecord): void {
    this.database.run(
      "INSERT INTO reviewer_feedback (id, finding_id, proposal_id, verdict, label, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.findingId,
        record.proposalId,
        record.verdict,
        record.label,
        record.createdAt
      ]
    );
  }

  listReviewerFeedback(): ReviewerFeedbackRecord[] {
    return (
      this.database.exec(
        "SELECT id, finding_id, proposal_id, verdict, label, created_at FROM reviewer_feedback ORDER BY created_at, id"
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" &&
      typeof row[1] === "string" &&
      typeof row[3] === "string" &&
      typeof row[5] === "string" &&
      (typeof row[2] === "string" || row[2] === null) &&
      (typeof row[4] === "string" || row[4] === null) &&
      ["false-positive", "useful", "needs-review"].includes(row[3])
        ? [
            {
              id: row[0],
              findingId: row[1],
              proposalId: row[2],
              verdict: row[3] as ReviewerFeedbackRecord["verdict"],
              label: row[4],
              createdAt: row[5]
            }
          ]
        : []
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
      reviewerFeedback: countRows(this.database, "reviewer_feedback"),
      scans: countRows(this.database, "scans")
    };
  }
}

function defaultTracePreferences(): TracePreferences {
  return {
    retentionDays: 30,
    storePromptSnapshots: false,
    storeModelOutputSnapshots: false,
    redactExcerpts: true,
    excludedFolders: []
  };
}

function safeStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string" && validateTraceMetadata(item))
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function safeMetadata(value: string): Record<string, string | number | boolean> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      validateTraceMetadata(parsed)
      ? (parsed as Record<string, string | number | boolean>)
      : null;
  } catch {
    return null;
  }
}

function durationBetween(startedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function numericAttribute(attributes: Record<string, string | number | boolean>, key: string): number {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function nullableNumericAttribute(
  attributes: Record<string, string | number | boolean>,
  key: string
): number | null {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringAttribute(
  attributes: Record<string, string | number | boolean>,
  key: string
): string | null {
  const value = attributes[key];
  return typeof value === "string" && validateTraceMetadata(value) ? value : null;
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
  reviewerFeedback: number;
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
