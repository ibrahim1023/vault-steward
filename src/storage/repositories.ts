import { createHash } from "node:crypto";

import type { Database } from "sql.js";
import type {
  EvidenceRef,
  Finding,
  FindingSeverity,
  FindingStatus,
  FindingType
} from "../contracts/index.js";
import {
  createFindingOccurrence,
  FINDING_TYPES,
  parseFindingIdentity,
  parseFindingOccurrence,
  type FindingIdentity
} from "../contracts/index.js";
import {
  isIntegrityEventKind,
  parseIntegrityEvent,
  parseNewIntegrityEvent,
  type IntegrityEvent,
  type IntegrityEventCategory,
  type NewIntegrityEvent,
  type SafeMetadataValue
} from "../contracts/integrity-event.js";
import {
  type AgentExecutionTrace,
  type TraceKind,
  type FindingLineage,
  type TracePreferences,
  type TraceSpan,
  validateTraceMetadata,
  validateTracePreferences
} from "../contracts/trace.js";
import { parseProposal, proposalDigest } from "../contracts/proposal.js";

const FINDING_TYPE_SET = new Set<string>(FINDING_TYPES);
const FINDING_SEVERITY_SET = new Set<string>(["info", "low", "medium", "high", "critical"]);
const FINDING_STATUS_SET = new Set<string>(["open", "dismissed", "approved", "applied", "stale"]);

export type ScanRecord = {
  id: string;
  vaultFingerprint: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  configHash: string;
  inputHash: string;
  parserVersion: string;
  identityProfileHash?: string;
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
  severity: string;
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
    const payload = JSON.parse(record.payloadJson) as unknown;
    if (
      !Array.isArray(evidence) ||
      !evidence.every(isEvidence) ||
      !isRecord(payload) ||
      !isFindingType(record.type) ||
      !isFindingSeverity(record.severity) ||
      !isFindingStatus(record.status) ||
      typeof payload.confidence !== "number" ||
      !Number.isFinite(payload.confidence) ||
      typeof payload.explanation !== "string"
    )
      return null;
    const base = {
      id: record.id,
      scanId: record.scanId,
      type: record.type,
      severity: record.severity,
      evidence,
      affectedNoteIds: [...new Set(evidence.map((item) => item.notePath))],
      ...(typeof payload.violatedPolicyId === "string"
        ? { violatedPolicyId: payload.violatedPolicyId }
        : {}),
      explanation: payload.explanation,
      suggestedFixes: [],
      confidence: payload.confidence,
      status: record.status
    };
    if (
      payload.identity !== undefined ||
      payload.stableKey !== undefined ||
      payload.occurrenceId !== undefined ||
      payload.evidenceRevisionKey !== undefined
    ) {
      const parsedIdentity = parseFindingIdentity(payload.identity);
      if (!parsedIdentity.ok || parsedIdentity.value.family !== record.type) return null;
      const identity = parsedIdentity.value;
      if (
        payload.stableKey !== identity.stableKey ||
        typeof payload.evidenceRevisionKey !== "string" ||
        !/^evidence:v1:[0-9a-f]{64}$/.test(payload.evidenceRevisionKey) ||
        typeof payload.occurrenceId !== "string"
      )
        return null;
      const occurrence = createFindingOccurrence({
        stableKey: identity.stableKey,
        scanId: record.scanId,
        evidenceRevisionKey: payload.evidenceRevisionKey,
        findingId: record.id
      });
      if (payload.occurrenceId !== occurrence.occurrenceId) return null;
      return {
        ...base,
        schemaVersion: 2,
        identity,
        stableKey: identity.stableKey,
        occurrenceId: occurrence.occurrenceId,
        evidenceRevisionKey: payload.evidenceRevisionKey
      };
    }
    return { ...base, schemaVersion: 1 };
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
  proposalDigest: string;
};

export type NewProposalRecord = Omit<ProposalRecord, "proposalDigest"> & {
  proposalDigest?: string;
};

export type ApprovalRecord = {
  id: string;
  proposalId: string;
  action: string;
  actedAt: string;
  appliedRevision: string | null;
  proposalDigest?: string | null;
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
  patternKey: string;
  createdAt: string;
};

export type TraceTimelineEntry = {
  id: string;
  parentSpanId: string | null;
  kind: TraceKind;
  startedAt: string;
  completedAt: string | null;
  outcome: "success" | "failure";
  durationMs: number | null;
  retryCount: number;
  fileCount: number | null;
  errorCode: string | null;
  attributes: Record<string, string | number | boolean>;
};

export type FindingLineageView = {
  findingId: string;
  evidenceLocators: string[];
  parsedArtifactIds: string[];
  validatorId: string;
  coordinatorDecisionId: string;
  agentExecutionId: string | null;
  retrievalMetadata: string[];
  policyEvaluationId: string | null;
  proposalSourceId: string | null;
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

export type TraceSnapshotView = {
  category: "prompt" | "model-output";
  createdAt: string;
  byteCount: number;
  metadata: Record<string, string | number | boolean>;
};

export type NoteSubjectRecord = {
  subjectId: string;
  currentPath: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type NotePathHistoryRecord = {
  subjectId: string;
  path: string;
  observedAt: string;
  retiredAt: string | null;
};

export type StoredFindingIdentity = {
  stableKey: string;
  identityVersion: number;
  family: string;
  subtype: string;
  detectorId: string;
  detectorVersion: string;
  policyId: string | null;
  policyVersion: string | null;
  subjectIds: readonly string[];
  semanticKey: string;
};

export type StoredFindingOccurrence = {
  occurrenceId: string;
  stableKey: string;
  findingId: string;
  scanId: string;
  evidenceRevisionKey: string;
  identityVersion: number;
};

export type ReviewDispositionKind =
  "acknowledged" | "ignored" | "snoozed" | "expected" | "restored";

export type ReviewDispositionRecord = {
  id: string;
  stableKey: string;
  sourceOccurrenceId: string;
  sourceEvidenceRevisionKey: string;
  kind: ReviewDispositionKind;
  reason: string | null;
  createdAt: string;
  untilAt: string | null;
  untilEvidenceChanges: boolean;
  restoresDispositionId: string | null;
};

export type IntegrityRetentionSettings = {
  operationalDays: number;
  updatedAt: string;
};

export type RetentionDeletionRecord = {
  sequence: number;
  occurredAt: string;
  category: string;
  reason: string;
  deletedCount: number;
  rangeStart: string | null;
  rangeEnd: string | null;
};

export type OperationalTraceMetrics = {
  scanDurationMs: number | null;
  agentDurationMs: number;
  p50ScanDurationMs: number | null;
  p95ScanDurationMs: number | null;
  parseFailures: number;
  indexFailures: number;
  retrievalFailures: number;
  validationFailures: number;
  cacheHitRate: number | null;
  queueDepth: number;
  databaseBytes: number;
  modelLoadTimeMs: number | null;
  tokenUsage: number;
  retries: number;
  incompleteRate: number;
  staleProposals: number;
  applyFailures: number;
};

export type ObservabilitySnapshot = {
  scanId: string | null;
  timeline: TraceTimelineEntry[];
  lineage: FindingLineageView[];
  configuration: TraceConfigurationRecord | null;
  inventory: TraceInventory;
  snapshots: TraceSnapshotView[];
  metrics: OperationalTraceMetrics;
};

export class VaultStewardRepository {
  constructor(private readonly database: Database) {}

  saveScan(record: ScanRecord): void {
    this.database.run(
      "INSERT INTO scans (id, vault_fingerprint, started_at, finished_at, status, config_hash, input_hash, parser_version, identity_profile_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.vaultFingerprint,
        record.startedAt,
        record.finishedAt,
        record.status,
        record.configHash,
        record.inputHash,
        record.parserVersion,
        record.identityProfileHash ?? "legacy"
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
        "SELECT f.type, f.severity, f.evidence_json, MIN(s.started_at), MAX(s.started_at), COUNT(*), MAX(CASE WHEN f.status = 'stale' THEN 1 ELSE 0 END) FROM findings f JOIN scans s ON s.id = f.scan_id WHERE s.status = 'completed' GROUP BY f.type, f.severity, f.evidence_json"
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" &&
      typeof row[1] === "string" &&
      typeof row[2] === "string" &&
      typeof row[3] === "string" &&
      typeof row[4] === "string" &&
      typeof row[5] === "number" &&
      typeof row[6] === "number"
        ? [
            {
              type: row[0],
              severity: row[1],
              evidenceJson: row[2],
              firstSeen: row[3],
              lastSeen: row[4],
              occurrences: row[5],
              resolved: typeof latestCompletedScan === "string" && row[4] < latestCompletedScan,
              stale: row[6] === 1
            }
          ]
        : []
    );
  }

  saveProposal(record: NewProposalRecord): void {
    const parsed = parseProposal(JSON.parse(record.patchJson));
    if (!parsed.ok) throw new Error("Proposal record is invalid.");
    const digest = proposalDigest(parsed.value);
    this.database.run(
      "INSERT INTO proposals (id, finding_id, patch_json, source_revisions_json, status, proposal_digest) VALUES (?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.findingId,
        record.patchJson,
        record.sourceRevisionsJson,
        record.status,
        digest
      ]
    );
  }

  findProposal(id: string): ProposalRecord | null {
    const row = this.database.exec(
      "SELECT id, finding_id, patch_json, source_revisions_json, status, proposal_digest FROM proposals WHERE id = ?",
      [id]
    )[0]?.values[0];
    return row && row.every((value) => typeof value === "string")
      ? {
          id: row[0] as string,
          findingId: row[1] as string,
          patchJson: row[2] as string,
          sourceRevisionsJson: row[3] as string,
          status: row[4] as string,
          proposalDigest: row[5] as string
        }
      : null;
  }

  getApprovedProposalDigest(proposalId: string): string | null {
    const value = this.database.exec(
      "SELECT proposal_digest FROM approvals WHERE proposal_id = ? AND action = 'approved' ORDER BY acted_at DESC LIMIT 1",
      [proposalId]
    )[0]?.values[0]?.[0];
    return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
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
      "INSERT INTO approvals (id, proposal_id, action, acted_at, applied_revision, proposal_digest) VALUES (?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.proposalId,
        record.action,
        record.actedAt,
        record.appliedRevision,
        record.proposalDigest ?? null
      ]
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
      "INSERT INTO finding_lineage (finding_id, scan_id, evidence_locators_json, parsed_artifact_ids_json, validator_id, coordinator_decision_id, agent_execution_id, retrieval_metadata_json, policy_evaluation_id, proposal_source_id, correlation_id, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        lineage.findingId,
        lineage.scanId,
        JSON.stringify(lineage.evidenceLocators),
        JSON.stringify(lineage.parsedArtifactIds),
        lineage.validatorId,
        lineage.coordinatorDecisionId,
        lineage.agentExecutionId ?? null,
        JSON.stringify(lineage.retrievalMetadata ?? []),
        lineage.policyEvaluationId ?? null,
        lineage.proposalSourceId ?? null,
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
      [
        crypto.randomUUID(),
        scanId,
        category,
        snapshot,
        new TextEncoder().encode(snapshot).length,
        new Date().toISOString()
      ]
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
      inventory: this.getTraceInventory(),
      snapshots: selectedScanId ? this.listTraceSnapshots(selectedScanId) : [],
      metrics: this.getOperationalTraceMetrics(selectedScanId, timeline)
    };
  }

  private listTraceSnapshots(scanId: string): TraceSnapshotView[] {
    return (
      this.database.exec(
        "SELECT category, snapshot_json, byte_count, created_at FROM trace_snapshots WHERE scan_id = ? ORDER BY created_at, id",
        [scanId]
      )[0]?.values ?? []
    ).flatMap((row) => {
      const [category, source, byteCount, createdAt] = row;
      const metadata = typeof source === "string" ? safeMetadata(source) : null;
      return (category === "prompt" || category === "model-output") &&
        typeof byteCount === "number" &&
        typeof createdAt === "string" &&
        metadata !== null
        ? [{ category, createdAt, byteCount, metadata }]
        : [];
    });
  }

  private getOperationalTraceMetrics(
    scanId: string | null,
    timeline: readonly TraceTimelineEntry[]
  ): OperationalTraceMetrics {
    const durations = timeline.flatMap((span) =>
      span.durationMs === null ? [] : [span.durationMs]
    );
    const agentDurations =
      this.database.exec("SELECT duration_ms FROM agent_executions WHERE scan_id = ?", [
        scanId ?? ""
      ])[0]?.values ?? [];
    const tokens = this.database.exec(
      "SELECT COALESCE(SUM(input_tokens + output_tokens), 0) FROM model_traces WHERE scan_id = ?",
      [scanId ?? ""]
    )[0]?.values[0]?.[0];
    const retries = this.database.exec(
      "SELECT COALESCE(SUM(retry_count), 0) FROM agent_executions WHERE scan_id = ?",
      [scanId ?? ""]
    )[0]?.values[0]?.[0];
    const queueDepth = this.database.exec(
      "SELECT COUNT(*) FROM findings WHERE scan_id = ? AND status = 'open'",
      [scanId ?? ""]
    )[0]?.values[0]?.[0];
    const staleProposals = this.database.exec(
      "SELECT COUNT(*) FROM proposals WHERE status = 'stale'"
    )[0]?.values[0]?.[0];
    const applyFailures = this.database.exec(
      "SELECT COUNT(*) FROM proposals WHERE status IN ('apply-failed', 'recovery-required')"
    )[0]?.values[0]?.[0];
    const completedScans = this.database.exec(
      "SELECT COUNT(*) FROM scans WHERE status = 'completed'"
    )[0]?.values[0]?.[0];
    const incompleteScans = this.database.exec(
      "SELECT COUNT(*) FROM scans WHERE status <> 'completed'"
    )[0]?.values[0]?.[0];
    const failures = (kind: string) =>
      timeline.filter((span) => span.kind === kind && span.outcome === "failure").length;
    return {
      scanDurationMs: calculateLocalPercentile(durations, 1),
      agentDurationMs: agentDurations.reduce(
        (total, row) => total + (typeof row[0] === "number" ? row[0] : 0),
        0
      ),
      p50ScanDurationMs: calculateLocalPercentile(durations, 0.5),
      p95ScanDurationMs: calculateLocalPercentile(durations, 0.95),
      parseFailures: failures("scanner"),
      indexFailures: failures("indexing"),
      retrievalFailures: failures("retrieval"),
      validationFailures: failures("validation"),
      cacheHitRate: null,
      queueDepth: typeof queueDepth === "number" ? queueDepth : 0,
      databaseBytes: this.database.export().byteLength,
      modelLoadTimeMs: null,
      tokenUsage: typeof tokens === "number" ? tokens : 0,
      retries: typeof retries === "number" ? retries : 0,
      incompleteRate:
        typeof completedScans === "number" && typeof incompleteScans === "number"
          ? incompleteScans / Math.max(1, completedScans + incompleteScans)
          : 0,
      staleProposals: typeof staleProposals === "number" ? staleProposals : 0,
      applyFailures: typeof applyFailures === "number" ? applyFailures : 0
    };
  }

  private listTraceTimeline(scanId: string): TraceTimelineEntry[] {
    return (
      this.database.exec(
        "SELECT id, parent_span_id, kind, started_at, completed_at, outcome, attributes_json FROM trace_spans WHERE scan_id = ? ORDER BY started_at, id",
        [scanId]
      )[0]?.values ?? []
    ).flatMap((row) => {
      const [id, parentSpanId, kind, startedAt, completedAt, outcome, attributesJson] = row;
      const attributes = typeof attributesJson === "string" ? safeMetadata(attributesJson) : null;
      if (
        typeof id !== "string" ||
        (typeof parentSpanId !== "string" && parentSpanId !== null) ||
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
          parentSpanId,
          kind: kind as TraceKind,
          startedAt,
          completedAt,
          outcome,
          durationMs: durationBetween(startedAt, completedAt),
          retryCount: numericAttribute(attributes, "retryCount"),
          fileCount: nullableNumericAttribute(attributes, "fileCount"),
          errorCode: stringAttribute(attributes, "errorCode"),
          attributes
        }
      ];
    });
  }

  private listFindingLineage(scanId: string): FindingLineageView[] {
    return (
      this.database.exec(
        "SELECT finding_id, evidence_locators_json, parsed_artifact_ids_json, validator_id, coordinator_decision_id, agent_execution_id, retrieval_metadata_json, policy_evaluation_id, proposal_source_id FROM finding_lineage WHERE scan_id = ? ORDER BY finding_id",
        [scanId]
      )[0]?.values ?? []
    ).flatMap((row) => {
      const evidenceLocators = typeof row[1] === "string" ? safeStringArray(row[1]) : [];
      const parsedArtifactIds = typeof row[2] === "string" ? safeStringArray(row[2]) : [];
      const retrievalMetadata = typeof row[6] === "string" ? safeStringArray(row[6]) : [];
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
              agentExecutionId: row[5],
              retrievalMetadata,
              policyEvaluationId: typeof row[7] === "string" ? row[7] : null,
              proposalSourceId: typeof row[8] === "string" ? row[8] : null
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
    return typeof row?.[0] === "string" && values !== null ? { fingerprint: row[0], values } : null;
  }

  deleteTraceForScan(scanId: string, deletedAt: string, id: string): void {
    this.database.run("DELETE FROM agent_executions WHERE scan_id = ?", [scanId]);
    this.database.run("DELETE FROM trace_spans WHERE scan_id = ?", [scanId]);
    this.database.run("DELETE FROM finding_lineage WHERE scan_id = ?", [scanId]);
    this.database.run("DELETE FROM trace_configurations WHERE scan_id = ?", [scanId]);
    this.database.run("DELETE FROM trace_snapshots WHERE scan_id = ?", [scanId]);
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

  pruneExpiredTraceData(now: string): number {
    const timestamp = Date.parse(now);
    if (!Number.isFinite(timestamp)) throw new Error("Trace retention timestamp is invalid.");
    const cutoff = new Date(
      timestamp - this.getTracePreferences().retentionDays * 24 * 60 * 60 * 1_000
    ).toISOString();
    const scanIds = (
      this.database.exec("SELECT id FROM scans WHERE started_at < ? ORDER BY started_at", [
        cutoff
      ])[0]?.values ?? []
    ).flatMap((row) => (typeof row[0] === "string" ? [row[0]] : []));
    for (const scanId of scanIds) this.deleteTraceForScan(scanId, now, crypto.randomUUID());
    return scanIds.length;
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
      "INSERT INTO reviewer_feedback (id, finding_id, proposal_id, verdict, label, pattern_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.findingId,
        record.proposalId,
        record.verdict,
        record.label,
        record.patternKey,
        record.createdAt
      ]
    );
  }

  listReviewerFeedback(): ReviewerFeedbackRecord[] {
    return (
      this.database.exec(
        "SELECT id, finding_id, proposal_id, verdict, label, pattern_key, created_at FROM reviewer_feedback ORDER BY created_at, id"
      )[0]?.values ?? []
    ).flatMap((row) =>
      typeof row[0] === "string" &&
      typeof row[1] === "string" &&
      typeof row[3] === "string" &&
      typeof row[5] === "string" &&
      typeof row[6] === "string" &&
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
              patternKey: row[5],
              createdAt: row[6]
            }
          ]
        : []
    );
  }

  withTransaction<T>(operation: () => T): T {
    this.database.run("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.run("COMMIT");
      return result;
    } catch (error) {
      this.database.run("ROLLBACK");
      throw error;
    }
  }

  bindNoteSubject(input: {
    subjectId: string;
    path: string;
    observedAt: string;
  }): NoteSubjectRecord {
    if (
      !isSafeStorageString(input.subjectId, 256) ||
      !isVaultRelativePath(input.path) ||
      !isValidIsoTimestamp(input.observedAt)
    ) {
      throw new Error("invalid note subject binding");
    }
    return this.withTransaction(() => {
      const existing = this.database.exec(
        "SELECT subject_id FROM note_subjects WHERE subject_id = ? OR current_path = ?",
        [input.subjectId, input.path]
      )[0]?.values;
      if (existing && existing.length > 0) {
        throw new Error("note subject or path is already bound");
      }
      this.database.run(
        "INSERT INTO note_subjects (subject_id, current_path, created_at, deleted_at) VALUES (?, ?, ?, NULL)",
        [input.subjectId, input.path, input.observedAt]
      );
      this.database.run(
        "INSERT INTO note_path_history (subject_id, path, observed_at, retired_at) VALUES (?, ?, ?, NULL)",
        [input.subjectId, input.path, input.observedAt]
      );
      return {
        subjectId: input.subjectId,
        currentPath: input.path,
        createdAt: input.observedAt,
        deletedAt: null
      };
    });
  }

  renameNoteSubject(input: {
    subjectId: string;
    oldPath: string;
    newPath: string;
    observedAt: string;
  }): NoteSubjectRecord {
    if (
      !isSafeStorageString(input.subjectId, 256) ||
      !isVaultRelativePath(input.oldPath) ||
      !isVaultRelativePath(input.newPath) ||
      !isValidIsoTimestamp(input.observedAt)
    ) {
      throw new Error("invalid note subject rename");
    }
    return this.withTransaction(() => {
      const record = this.loadNoteSubject(input.subjectId);
      if (!record || record.deletedAt !== null || record.currentPath !== input.oldPath) {
        throw new Error("no active binding for subject and path");
      }
      const pathTaken = this.database.exec(
        "SELECT subject_id FROM note_subjects WHERE current_path = ?",
        [input.newPath]
      )[0]?.values;
      if (pathTaken && pathTaken.length > 0) {
        throw new Error("new path is already bound");
      }
      this.database.run(
        "UPDATE note_path_history SET retired_at = ? WHERE subject_id = ? AND path = ? AND retired_at IS NULL",
        [input.observedAt, input.subjectId, input.oldPath]
      );
      this.database.run("UPDATE note_subjects SET current_path = ? WHERE subject_id = ?", [
        input.newPath,
        input.subjectId
      ]);
      this.database.run(
        "INSERT INTO note_path_history (subject_id, path, observed_at, retired_at) VALUES (?, ?, ?, NULL)",
        [input.subjectId, input.newPath, input.observedAt]
      );
      return { ...record, currentPath: input.newPath };
    });
  }

  deleteNoteSubject(input: {
    subjectId: string;
    path: string;
    deletedAt: string;
  }): NoteSubjectRecord {
    if (
      !isSafeStorageString(input.subjectId, 256) ||
      !isVaultRelativePath(input.path) ||
      !isValidIsoTimestamp(input.deletedAt)
    ) {
      throw new Error("invalid note subject deletion");
    }
    return this.withTransaction(() => {
      const record = this.loadNoteSubject(input.subjectId);
      if (!record || record.deletedAt !== null || record.currentPath !== input.path) {
        throw new Error("no active binding for subject and path");
      }
      this.database.run(
        "UPDATE note_path_history SET retired_at = ? WHERE subject_id = ? AND path = ? AND retired_at IS NULL",
        [input.deletedAt, input.subjectId, input.path]
      );
      this.database.run(
        "UPDATE note_subjects SET current_path = NULL, deleted_at = ? WHERE subject_id = ?",
        [input.deletedAt, input.subjectId]
      );
      return { ...record, currentPath: null, deletedAt: input.deletedAt };
    });
  }

  findNoteSubjectByPath(path: string): NoteSubjectRecord | null {
    const row = this.database.exec(
      "SELECT subject_id, current_path, created_at, deleted_at FROM note_subjects WHERE current_path = ? AND deleted_at IS NULL",
      [path]
    )[0]?.values[0];
    return row ? toNoteSubjectRecord(row) : null;
  }

  listActiveNoteSubjects(): NoteSubjectRecord[] {
    return (
      this.database.exec(
        "SELECT subject_id, current_path, created_at, deleted_at FROM note_subjects WHERE deleted_at IS NULL ORDER BY current_path"
      )[0]?.values ?? []
    ).flatMap((row) => {
      const record = toNoteSubjectRecord(row);
      return record && record.currentPath !== null ? [record] : [];
    });
  }

  listNotePathHistory(subjectId: string): NotePathHistoryRecord[] {
    return (
      this.database.exec(
        "SELECT subject_id, path, observed_at, retired_at FROM note_path_history WHERE subject_id = ? ORDER BY observed_at, rowid",
        [subjectId]
      )[0]?.values ?? []
    ).flatMap((row) => {
      const [subject, path, observedAt, retiredAt] = row;
      return typeof subject === "string" &&
        typeof path === "string" &&
        typeof observedAt === "string" &&
        (typeof retiredAt === "string" || retiredAt === null)
        ? [{ subjectId: subject, path, observedAt, retiredAt }]
        : [];
    });
  }

  private loadNoteSubject(subjectId: string): NoteSubjectRecord | null {
    const row = this.database.exec(
      "SELECT subject_id, current_path, created_at, deleted_at FROM note_subjects WHERE subject_id = ?",
      [subjectId]
    )[0]?.values[0];
    return row ? toNoteSubjectRecord(row) : null;
  }

  saveFindingIdentity(identity: StoredFindingIdentity): void {
    const parsed = this.validateStoredIdentity(identity);
    const subjectIdsJson = JSON.stringify(parsed.subjectIds);
    const existing = this.database.exec(
      "SELECT stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key FROM finding_identities WHERE stable_key = ?",
      [identity.stableKey]
    )[0]?.values[0];
    if (existing) {
      const stored = toStoredIdentityRow(existing);
      if (!stored) throw new Error("stored finding identity is invalid");
      if (
        stored.identityVersion !== identity.identityVersion ||
        stored.family !== identity.family ||
        stored.subtype !== identity.subtype ||
        stored.detectorId !== identity.detectorId ||
        stored.detectorVersion !== identity.detectorVersion ||
        stored.policyId !== identity.policyId ||
        stored.policyVersion !== identity.policyVersion ||
        stored.subjectIdsJson !== subjectIdsJson ||
        stored.semanticKey !== identity.semanticKey
      ) {
        throw new Error("finding identity mismatch for stable key");
      }
      return;
    }
    this.database.run(
      "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        identity.stableKey,
        identity.identityVersion,
        identity.family,
        identity.subtype,
        identity.detectorId,
        identity.detectorVersion,
        identity.policyId,
        identity.policyVersion,
        subjectIdsJson,
        identity.semanticKey
      ]
    );
  }

  listFindingIdentities(): StoredFindingIdentity[] {
    return (
      this.database.exec(
        "SELECT stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key FROM finding_identities ORDER BY stable_key"
      )[0]?.values ?? []
    ).map((row) => {
      const stored = toStoredIdentityRow(row);
      if (!stored) throw new Error("stored finding identity is invalid");
      if (stored.identityVersion === 1) {
        const parsed = parseFindingIdentity({
          schemaVersion: 1,
          identityVersion: 1,
          stableKey: stored.stableKey,
          family: stored.family as FindingType,
          subtype: stored.subtype,
          detectorId: stored.detectorId,
          detectorVersion: stored.detectorVersion,
          ...(stored.policyId !== null ? { policyId: stored.policyId } : {}),
          ...(stored.policyVersion !== null ? { policyVersion: stored.policyVersion } : {}),
          subjectIds: stored.subjectIds,
          semanticKey: stored.semanticKey
        });
        if (!parsed.ok) {
          throw new Error("stored finding identity fails contract validation");
        }
      } else if (!isLegacyIdentityShape(stored)) {
        throw new Error("stored finding identity is invalid");
      }
      return {
        stableKey: stored.stableKey,
        identityVersion: stored.identityVersion,
        family: stored.family,
        subtype: stored.subtype,
        detectorId: stored.detectorId,
        detectorVersion: stored.detectorVersion,
        policyId: stored.policyId,
        policyVersion: stored.policyVersion,
        subjectIds: stored.subjectIds,
        semanticKey: stored.semanticKey
      };
    });
  }

  saveFindingOccurrence(occurrence: StoredFindingOccurrence): void {
    if (occurrence.identityVersion !== 1) {
      throw new Error("unsupported finding occurrence identity version");
    }
    const parsed = parseFindingOccurrence({
      schemaVersion: 1,
      occurrenceId: occurrence.occurrenceId,
      stableKey: occurrence.stableKey,
      scanId: occurrence.scanId,
      evidenceRevisionKey: occurrence.evidenceRevisionKey,
      findingId: occurrence.findingId
    });
    if (!parsed.ok) {
      throw new Error(`invalid finding occurrence: ${parsed.diagnostics.join("; ")}`);
    }
    const existing = this.database.exec(
      "SELECT occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version FROM finding_occurrences WHERE occurrence_id = ?",
      [occurrence.occurrenceId]
    )[0]?.values[0];
    if (existing) {
      const stored = toStoredOccurrenceRow(existing);
      if (!stored) throw new Error("stored finding occurrence is invalid");
      if (
        stored.stableKey !== occurrence.stableKey ||
        stored.findingId !== occurrence.findingId ||
        stored.scanId !== occurrence.scanId ||
        stored.evidenceRevisionKey !== occurrence.evidenceRevisionKey ||
        stored.identityVersion !== occurrence.identityVersion
      ) {
        throw new Error("finding occurrence mismatch for occurrence id");
      }
      return;
    }
    this.database.run(
      "INSERT INTO finding_occurrences (occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version) VALUES (?, ?, ?, ?, ?, ?)",
      [
        occurrence.occurrenceId,
        occurrence.stableKey,
        occurrence.findingId,
        occurrence.scanId,
        occurrence.evidenceRevisionKey,
        occurrence.identityVersion
      ]
    );
  }

  listFindingOccurrences(query?: {
    scanId?: string;
    stableKey?: string;
  }): StoredFindingOccurrence[] {
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (query?.scanId) {
      clauses.push("scan_id = ?");
      parameters.push(query.scanId);
    }
    if (query?.stableKey) {
      clauses.push("stable_key = ?");
      parameters.push(query.stableKey);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return (
      this.database.exec(
        `SELECT occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version FROM finding_occurrences${where} ORDER BY occurrence_id`,
        parameters
      )[0]?.values ?? []
    ).map((row) => {
      const stored = toStoredOccurrenceRow(row);
      if (!stored) throw new Error("stored finding occurrence is invalid");
      if (stored.identityVersion === 1) {
        const parsed = parseFindingOccurrence({
          schemaVersion: 1,
          occurrenceId: stored.occurrenceId,
          stableKey: stored.stableKey,
          scanId: stored.scanId,
          evidenceRevisionKey: stored.evidenceRevisionKey,
          findingId: stored.findingId
        });
        if (!parsed.ok) {
          throw new Error("stored finding occurrence fails contract validation");
        }
      } else if (
        stored.identityVersion !== 0 ||
        !isLegacyOccurrenceShape(stored) ||
        !this.isLegacyIdentity(stored.stableKey)
      ) {
        throw new Error("stored finding occurrence is invalid");
      }
      return {
        occurrenceId: stored.occurrenceId,
        stableKey: stored.stableKey,
        findingId: stored.findingId,
        scanId: stored.scanId,
        evidenceRevisionKey: stored.evidenceRevisionKey,
        identityVersion: stored.identityVersion
      };
    });
  }

  private validateStoredIdentity(identity: StoredFindingIdentity): FindingIdentity {
    if (identity.identityVersion !== 1) {
      throw new Error("unsupported finding identity version");
    }
    const parsed = parseFindingIdentity({
      schemaVersion: 1,
      identityVersion: 1,
      stableKey: identity.stableKey,
      family: identity.family as FindingType,
      subtype: identity.subtype,
      detectorId: identity.detectorId,
      detectorVersion: identity.detectorVersion,
      ...(identity.policyId !== null ? { policyId: identity.policyId } : {}),
      ...(identity.policyVersion !== null ? { policyVersion: identity.policyVersion } : {}),
      subjectIds: identity.subjectIds,
      semanticKey: identity.semanticKey
    });
    if (!parsed.ok) {
      throw new Error(`invalid finding identity: ${parsed.diagnostics.join("; ")}`);
    }
    return parsed.value;
  }

  appendIntegrityEvent(event: NewIntegrityEvent): IntegrityEvent {
    const parsed = parseNewIntegrityEvent(event);
    if (!parsed.ok) {
      throw new Error(`invalid integrity event: ${parsed.diagnostics.join("; ")}`);
    }
    const incoming = parsed.value;
    return this.withTransaction(() => {
      const existingRow = this.database.exec(
        "SELECT sequence, id, schema_version, category, kind, occurred_at, scan_id, stable_key, occurrence_id, proposal_id, approval_id, safe_metadata_json FROM integrity_events WHERE id = ?",
        [incoming.id]
      )[0]?.values[0];
      if (existingRow) {
        const persisted = this.hydrateIntegrityEvent(existingRow);
        if (!sameIntegrityEventContent(persisted, incoming)) {
          throw new Error("integrity event id conflict");
        }
        return persisted;
      }
      this.assertIntegrityEventReferences(incoming);
      this.database.run(
        "INSERT INTO integrity_events (id, schema_version, category, kind, occurred_at, scan_id, stable_key, occurrence_id, proposal_id, approval_id, safe_metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          incoming.id,
          incoming.schemaVersion,
          incoming.category,
          incoming.kind,
          incoming.occurredAt,
          incoming.scanId ?? null,
          incoming.stableKey ?? null,
          incoming.occurrenceId ?? null,
          incoming.proposalId ?? null,
          incoming.approvalId ?? null,
          canonicalMetadataJson(incoming.safeMetadata)
        ]
      );
      const sequence = this.database.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0];
      if (typeof sequence !== "number") throw new Error("integrity event sequence is missing");
      return { sequence, ...incoming };
    });
  }

  listIntegrityEvents(query?: {
    category?: IntegrityEventCategory;
    scanId?: string;
  }): IntegrityEvent[] {
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (query?.category) {
      clauses.push("category = ?");
      parameters.push(query.category);
    }
    if (query?.scanId) {
      clauses.push("scan_id = ?");
      parameters.push(query.scanId);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return (
      this.database.exec(
        `SELECT sequence, id, schema_version, category, kind, occurred_at, scan_id, stable_key, occurrence_id, proposal_id, approval_id, safe_metadata_json FROM integrity_events${where} ORDER BY sequence`,
        parameters
      )[0]?.values ?? []
    ).flatMap((row) => {
      const classified = this.classifyIntegrityEventRow(row);
      return classified.kind === "known" ? [classified.event] : [];
    });
  }

  private classifyIntegrityEventRow(
    row: unknown[]
  ): { kind: "known"; event: IntegrityEvent } | { kind: "unknown" } {
    const invalid = (): never => {
      throw new Error("stored integrity event is invalid");
    };
    const [sequence, id, schemaVersion, category, kind, occurredAt] = row;
    if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 1) {
      invalid();
    }
    if (!isSafeStorageString(id, 256)) invalid();
    if (
      typeof schemaVersion !== "number" ||
      !Number.isSafeInteger(schemaVersion) ||
      schemaVersion < 1
    ) {
      invalid();
    }
    if (category !== "audit" && category !== "review" && category !== "operational") {
      invalid();
    }
    if (!isSafeStorageString(kind, 80)) invalid();
    if (!isValidIsoTimestamp(occurredAt)) invalid();
    for (const index of [6, 7, 8, 9, 10]) {
      const value = row[index];
      if (value !== null && value !== undefined && !isSafeStorageString(value, 256)) {
        invalid();
      }
    }
    const metadataJson = row[11];
    if (typeof metadataJson !== "string") invalid();
    let metadata: unknown;
    try {
      metadata = JSON.parse(metadataJson as string);
    } catch {
      invalid();
    }
    if (!isRecord(metadata)) invalid();
    const entries = Object.entries(metadata as Record<string, unknown>);
    if (entries.length > 32) invalid();
    if (new TextEncoder().encode(metadataJson as string).length > 4096) invalid();
    for (const [key, value] of entries) {
      if (!isSafeStorageString(key, 64)) invalid();
      if (value === null || typeof value === "boolean") continue;
      if (typeof value === "number") {
        if (!Number.isFinite(value)) invalid();
        continue;
      }
      if (!isSafeStorageString(value, 256)) invalid();
    }
    if (
      schemaVersion !== 1 ||
      !isIntegrityEventKind(category as IntegrityEventCategory, kind as string)
    ) {
      return { kind: "unknown" };
    }
    const candidate = {
      sequence,
      id,
      schemaVersion,
      category,
      kind,
      occurredAt,
      ...(row[6] !== null && row[6] !== undefined ? { scanId: row[6] } : {}),
      ...(row[7] !== null && row[7] !== undefined ? { stableKey: row[7] } : {}),
      ...(row[8] !== null && row[8] !== undefined ? { occurrenceId: row[8] } : {}),
      ...(row[9] !== null && row[9] !== undefined ? { proposalId: row[9] } : {}),
      ...(row[10] !== null && row[10] !== undefined ? { approvalId: row[10] } : {}),
      safeMetadata: metadata
    };
    const parsed = parseIntegrityEvent(candidate);
    if (!parsed.ok) invalid();
    return { kind: "known", event: (parsed as { ok: true; value: IntegrityEvent }).value };
  }

  private hydrateIntegrityEvent(row: unknown[]): IntegrityEvent {
    const classified = this.classifyIntegrityEventRow(row);
    if (classified.kind !== "known") {
      throw new Error("stored integrity event is invalid");
    }
    return classified.event;
  }

  private assertIntegrityEventReferences(event: NewIntegrityEvent): void {
    if (
      event.scanId !== undefined &&
      !this.rowExists("SELECT id FROM scans WHERE id = ?", event.scanId)
    ) {
      throw new Error("integrity event references an unknown scan");
    }
    if (
      event.stableKey !== undefined &&
      !this.rowExists(
        "SELECT stable_key FROM finding_identities WHERE stable_key = ?",
        event.stableKey
      )
    ) {
      throw new Error("integrity event references an unknown finding identity");
    }
    if (
      event.occurrenceId !== undefined &&
      !this.rowExists(
        "SELECT occurrence_id FROM finding_occurrences WHERE occurrence_id = ?",
        event.occurrenceId
      )
    ) {
      throw new Error("integrity event references an unknown finding occurrence");
    }
    if (
      event.proposalId !== undefined &&
      !this.rowExists("SELECT id FROM proposals WHERE id = ?", event.proposalId)
    ) {
      throw new Error("integrity event references an unknown proposal");
    }
    if (
      event.approvalId !== undefined &&
      !this.rowExists("SELECT id FROM approvals WHERE id = ?", event.approvalId)
    ) {
      throw new Error("integrity event references an unknown approval");
    }
  }

  private rowExists(sql: string, value: string): boolean {
    return (this.database.exec(sql, [value])[0]?.values.length ?? 0) > 0;
  }

  private isLegacyIdentity(stableKey: string): boolean {
    const row = this.database.exec(
      "SELECT stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key FROM finding_identities WHERE stable_key = ?",
      [stableKey]
    )[0]?.values[0];
    const stored = row ? toStoredIdentityRow(row) : null;
    return stored !== null && isLegacyIdentityShape(stored);
  }

  appendReviewDisposition(disposition: ReviewDispositionRecord): void {
    if (
      !isSafeStorageString(disposition.id, 256) ||
      !isSafeStorageString(disposition.stableKey, 256) ||
      !isSafeStorageString(disposition.sourceOccurrenceId, 256) ||
      !isSafeStorageString(disposition.sourceEvidenceRevisionKey, 256) ||
      !REVIEW_DISPOSITION_KIND_SET.has(disposition.kind)
    ) {
      throw new Error("invalid review disposition");
    }
    if (!isValidIsoTimestamp(disposition.createdAt)) {
      throw new Error("review disposition timestamp is invalid");
    }
    if (disposition.untilAt !== null && !isValidIsoTimestamp(disposition.untilAt)) {
      throw new Error("review disposition snooze timestamp is invalid");
    }
    if (disposition.reason !== null && !isSafeStorageString(disposition.reason, 512)) {
      throw new Error("review disposition reason is invalid");
    }
    if (disposition.kind === "snoozed") {
      if ((disposition.untilAt !== null) === disposition.untilEvidenceChanges) {
        throw new Error("snoozed requires exactly one of untilAt or untilEvidenceChanges");
      }
    } else if (disposition.untilAt !== null || disposition.untilEvidenceChanges) {
      throw new Error("non-snoozed dispositions cannot carry snooze bounds");
    }
    const occurrence = this.database.exec(
      "SELECT stable_key, evidence_revision_key FROM finding_occurrences WHERE occurrence_id = ?",
      [disposition.sourceOccurrenceId]
    )[0]?.values[0];
    if (
      !occurrence ||
      occurrence[0] !== disposition.stableKey ||
      occurrence[1] !== disposition.sourceEvidenceRevisionKey
    ) {
      throw new Error("review disposition references an unknown or mismatched occurrence");
    }
    if (disposition.kind === "restored") {
      if (disposition.restoresDispositionId === null) {
        throw new Error("restored requires a disposition target");
      }
      const target = this.database.exec(
        "SELECT kind FROM review_dispositions WHERE id = ? AND stable_key = ?",
        [disposition.restoresDispositionId, disposition.stableKey]
      )[0]?.values[0]?.[0];
      if (typeof target !== "string" || target === "restored") {
        throw new Error(
          "restored requires an existing non-restored disposition for the same stable key"
        );
      }
      const alreadyReversed =
        this.database.exec(
          "SELECT id FROM review_dispositions WHERE kind = 'restored' AND restores_disposition_id = ?",
          [disposition.restoresDispositionId]
        )[0]?.values.length ?? 0;
      if (alreadyReversed > 0) {
        throw new Error("disposition target is already restored");
      }
    } else if (disposition.restoresDispositionId !== null) {
      throw new Error("non-restored dispositions cannot reference a restored target");
    }
    this.database.run(
      "INSERT INTO review_dispositions (id, stable_key, source_occurrence_id, source_evidence_revision_key, kind, reason, created_at, until_at, until_evidence_changes, restores_disposition_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        disposition.id,
        disposition.stableKey,
        disposition.sourceOccurrenceId,
        disposition.sourceEvidenceRevisionKey,
        disposition.kind,
        disposition.reason,
        disposition.createdAt,
        disposition.untilAt,
        disposition.untilEvidenceChanges ? 1 : 0,
        disposition.restoresDispositionId
      ]
    );
  }

  getEffectiveReviewDisposition(input: {
    stableKey: string;
    evidenceRevisionKey: string;
    now: string;
  }): ReviewDispositionRecord | null {
    if (
      !isSafeStorageString(input.stableKey, 256) ||
      !isSafeStorageString(input.evidenceRevisionKey, 256) ||
      !isValidIsoTimestamp(input.now)
    ) {
      throw new Error("invalid review disposition query");
    }
    const rows =
      this.database.exec(
        "SELECT id, stable_key, source_occurrence_id, source_evidence_revision_key, kind, reason, created_at, until_at, until_evidence_changes, restores_disposition_id FROM review_dispositions WHERE stable_key = ? ORDER BY created_at DESC, rowid DESC",
        [input.stableKey]
      )[0]?.values ?? [];
    const records = rows.map((row) => {
      const record = toReviewDispositionRecord(row);
      if (!record) throw new Error("stored review disposition is invalid");
      return record;
    });
    const reversed = new Set<string>();
    for (const record of records) {
      if (record.kind === "restored" && record.restoresDispositionId !== null) {
        reversed.add(record.restoresDispositionId);
      }
    }
    for (const record of records) {
      if (record.kind === "restored") continue;
      if (reversed.has(record.id)) continue;
      if (record.sourceEvidenceRevisionKey !== input.evidenceRevisionKey) continue;
      if (record.kind === "snoozed" && record.untilAt !== null && record.untilAt <= input.now) {
        continue;
      }
      return record;
    }
    return null;
  }

  getIntegrityRetentionSettings(): IntegrityRetentionSettings {
    const row = this.database.exec(
      "SELECT operational_days, updated_at FROM integrity_retention_settings WHERE id = 1"
    )[0]?.values[0];
    if (!row || typeof row[0] !== "number" || typeof row[1] !== "string") {
      throw new Error("integrity retention settings are missing");
    }
    return { operationalDays: row[0], updatedAt: row[1] };
  }

  setIntegrityRetentionSettings(settings: IntegrityRetentionSettings): void {
    if (
      !Number.isSafeInteger(settings.operationalDays) ||
      settings.operationalDays < 30 ||
      settings.operationalDays > 3650 ||
      !isValidIsoTimestamp(settings.updatedAt)
    ) {
      throw new Error("invalid integrity retention settings");
    }
    this.database.run(
      "UPDATE integrity_retention_settings SET operational_days = ?, updated_at = ? WHERE id = 1",
      [settings.operationalDays, settings.updatedAt]
    );
  }

  pruneOperationalIntegrityEvents(input: { now: string; reason: string }): number {
    if (!isValidIsoTimestamp(input.now) || !isSafeStorageString(input.reason, 512)) {
      throw new Error("invalid operational prune request");
    }
    const settings = this.getIntegrityRetentionSettings();
    const cutoff = new Date(
      Date.parse(input.now) - settings.operationalDays * 24 * 60 * 60 * 1_000
    ).toISOString();
    const protectedScanIds = new Set<string>();
    for (const row of this.database.exec(
      "SELECT id FROM scans WHERE status = 'completed' ORDER BY finished_at DESC, started_at DESC LIMIT 50"
    )[0]?.values ?? []) {
      if (typeof row[0] === "string") protectedScanIds.add(row[0]);
    }
    for (const row of this.database.exec(
      "SELECT DISTINCT scan_id FROM integrity_events WHERE category IN ('audit', 'review') AND scan_id IS NOT NULL"
    )[0]?.values ?? []) {
      if (typeof row[0] === "string") protectedScanIds.add(row[0]);
    }
    const candidates =
      this.database.exec(
        "SELECT sequence, scan_id, occurred_at FROM integrity_events WHERE category = 'operational' AND occurred_at < ?",
        [cutoff]
      )[0]?.values ?? [];
    const deletable = candidates.filter(
      (row) =>
        typeof row[0] === "number" &&
        typeof row[2] === "string" &&
        (row[1] === null || row[1] === undefined || !protectedScanIds.has(row[1] as string))
    );
    if (deletable.length === 0) return 0;
    const sequences = deletable.map((row) => row[0] as number);
    const occurredAts = deletable
      .map((row) => row[2] as string)
      .sort((left, right) => left.localeCompare(right));
    return this.withTransaction(() => {
      this.database.run(
        `DELETE FROM integrity_events WHERE sequence IN (${sequences.map(() => "?").join(", ")})`,
        sequences
      );
      this.database.run(
        "INSERT INTO retention_deletions (occurred_at, category, reason, deleted_count, range_start, range_end) VALUES (?, 'operational', ?, ?, ?, ?)",
        [
          input.now,
          input.reason,
          sequences.length,
          occurredAts[0] ?? null,
          occurredAts[occurredAts.length - 1] ?? null
        ]
      );
      return sequences.length;
    });
  }

  purgeIntegrityEvents(input: {
    category: "audit" | "review";
    reason: string;
    occurredAt?: { from?: string; through?: string };
  }): number {
    if (input.category !== "audit" && input.category !== "review") {
      throw new Error("explicit purge only supports audit or review events");
    }
    if (!isSafeStorageString(input.reason, 512)) {
      throw new Error("invalid purge reason");
    }
    const from = input.occurredAt?.from;
    const through = input.occurredAt?.through;
    if (from !== undefined && !isValidIsoTimestamp(from)) {
      throw new Error("purge range start is invalid");
    }
    if (through !== undefined && !isValidIsoTimestamp(through)) {
      throw new Error("purge range end is invalid");
    }
    if (from !== undefined && through !== undefined && from > through) {
      throw new Error("purge range is inverted");
    }
    const clauses = ["category = ?"];
    const parameters: string[] = [input.category];
    if (from !== undefined) {
      clauses.push("occurred_at >= ?");
      parameters.push(from);
    }
    if (through !== undefined) {
      clauses.push("occurred_at <= ?");
      parameters.push(through);
    }
    const where = clauses.join(" AND ");
    return this.withTransaction(() => {
      const range = this.database.exec(
        `SELECT MIN(occurred_at), MAX(occurred_at), COUNT(*) FROM integrity_events WHERE ${where}`,
        parameters
      )[0]?.values[0];
      const count = typeof range?.[2] === "number" ? range[2] : 0;
      if (count === 0) return 0;
      this.database.run(`DELETE FROM integrity_events WHERE ${where}`, parameters);
      this.database.run(
        "INSERT INTO retention_deletions (occurred_at, category, reason, deleted_count, range_start, range_end) VALUES (?, ?, ?, ?, ?, ?)",
        [
          new Date().toISOString(),
          input.category,
          input.reason,
          count,
          typeof range?.[0] === "string" ? range[0] : null,
          typeof range?.[1] === "string" ? range[1] : null
        ]
      );
      return count;
    });
  }

  listRetentionDeletions(): RetentionDeletionRecord[] {
    return (
      this.database.exec(
        "SELECT sequence, occurred_at, category, reason, deleted_count, range_start, range_end FROM retention_deletions ORDER BY sequence"
      )[0]?.values ?? []
    ).flatMap((row) => {
      const [sequence, occurredAt, category, reason, deletedCount, rangeStart, rangeEnd] = row;
      return typeof sequence === "number" &&
        typeof occurredAt === "string" &&
        typeof category === "string" &&
        typeof reason === "string" &&
        typeof deletedCount === "number" &&
        (typeof rangeStart === "string" || rangeStart === null) &&
        (typeof rangeEnd === "string" || rangeEnd === null)
        ? [
            {
              sequence,
              occurredAt,
              category,
              reason,
              deletedCount,
              rangeStart,
              rangeEnd
            }
          ]
        : [];
    });
  }

  backfillLegacyFindingOccurrences(): number {
    const rows =
      this.database.exec(
        "SELECT f.id, f.scan_id, f.type, f.evidence_json FROM findings f LEFT JOIN finding_occurrences o ON o.finding_id = f.id WHERE o.finding_id IS NULL ORDER BY f.id"
      )[0]?.values ?? [];
    if (rows.length === 0) return 0;
    return this.withTransaction(() => {
      let backfilled = 0;
      for (const row of rows) {
        const [findingId, scanId, type, evidenceJson] = row;
        if (
          typeof findingId !== "string" ||
          typeof scanId !== "string" ||
          typeof type !== "string" ||
          typeof evidenceJson !== "string"
        ) {
          throw new Error("legacy finding row is invalid");
        }
        const stableKey = `finding:v0:${createHash("sha256")
          .update(JSON.stringify([scanId, findingId]))
          .digest("hex")}`;
        const evidenceRevisionKey = `evidence:v0:${createHash("sha256")
          .update(JSON.stringify([scanId, findingId, evidenceJson]))
          .digest("hex")}`;
        const occurrenceId = `occurrence:v0:${createHash("sha256")
          .update(JSON.stringify([stableKey, scanId, evidenceRevisionKey]))
          .digest("hex")}`;
        this.database.run(
          "INSERT INTO finding_identities (stable_key, identity_version, family, subtype, detector_id, detector_version, policy_id, policy_version, subject_ids_json, semantic_key) VALUES (?, 0, ?, 'legacy', 'legacy-backfill', '0', NULL, NULL, '[]', ?)",
          [stableKey, type, findingId]
        );
        this.database.run(
          "INSERT INTO finding_occurrences (occurrence_id, stable_key, finding_id, scan_id, evidence_revision_key, identity_version) VALUES (?, ?, ?, ?, ?, 0)",
          [occurrenceId, stableKey, findingId, scanId, evidenceRevisionKey]
        );
        backfilled += 1;
      }
      return backfilled;
    });
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

const REVIEW_DISPOSITION_KIND_SET = new Set<string>([
  "acknowledged",
  "ignored",
  "snoozed",
  "expected",
  "restored"
]);

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function isSafeStorageString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maxLength &&
    !hasControlCharacters(value)
  );
}

function isVaultRelativePath(value: unknown): value is string {
  return (
    isSafeStorageString(value, 1024) &&
    !/^[\\/]/.test(value) &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !/(?:^|[\\/])\.{2}(?:[\\/]|$)/.test(value)
  );
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function toNoteSubjectRecord(row: unknown[]): NoteSubjectRecord | null {
  const [subjectId, currentPath, createdAt, deletedAt] = row;
  return typeof subjectId === "string" &&
    (typeof currentPath === "string" || currentPath === null) &&
    typeof createdAt === "string" &&
    (typeof deletedAt === "string" || deletedAt === null)
    ? { subjectId, currentPath, createdAt, deletedAt }
    : null;
}

type StoredIdentityRow = {
  stableKey: string;
  identityVersion: number;
  family: string;
  subtype: string;
  detectorId: string;
  detectorVersion: string;
  policyId: string | null;
  policyVersion: string | null;
  subjectIdsJson: string;
  subjectIds: readonly string[];
  semanticKey: string;
};

function toStoredIdentityRow(row: unknown[]): StoredIdentityRow | null {
  const [
    stableKey,
    identityVersion,
    family,
    subtype,
    detectorId,
    detectorVersion,
    policyId,
    policyVersion,
    subjectIdsJson,
    semanticKey
  ] = row;
  if (
    typeof stableKey !== "string" ||
    typeof identityVersion !== "number" ||
    typeof family !== "string" ||
    typeof subtype !== "string" ||
    typeof detectorId !== "string" ||
    typeof detectorVersion !== "string" ||
    (typeof policyId !== "string" && policyId !== null) ||
    (typeof policyVersion !== "string" && policyVersion !== null) ||
    typeof subjectIdsJson !== "string" ||
    typeof semanticKey !== "string"
  ) {
    return null;
  }
  let subjectIds: unknown;
  try {
    subjectIds = JSON.parse(subjectIdsJson);
  } catch {
    return null;
  }
  if (!Array.isArray(subjectIds) || !subjectIds.every((id) => typeof id === "string")) {
    return null;
  }
  return {
    stableKey,
    identityVersion,
    family,
    subtype,
    detectorId,
    detectorVersion,
    policyId,
    policyVersion,
    subjectIdsJson,
    subjectIds,
    semanticKey
  };
}

type StoredOccurrenceRow = {
  occurrenceId: string;
  stableKey: string;
  findingId: string;
  scanId: string;
  evidenceRevisionKey: string;
  identityVersion: number;
};

function toStoredOccurrenceRow(row: unknown[]): StoredOccurrenceRow | null {
  const [occurrenceId, stableKey, findingId, scanId, evidenceRevisionKey, identityVersion] = row;
  return typeof occurrenceId === "string" &&
    typeof stableKey === "string" &&
    typeof findingId === "string" &&
    typeof scanId === "string" &&
    typeof evidenceRevisionKey === "string" &&
    typeof identityVersion === "number"
    ? { occurrenceId, stableKey, findingId, scanId, evidenceRevisionKey, identityVersion }
    : null;
}

const LEGACY_STABLE_KEY_PATTERN = /^finding:v0:[0-9a-f]{64}$/;
const LEGACY_EVIDENCE_KEY_PATTERN = /^evidence:v0:[0-9a-f]{64}$/;
const LEGACY_OCCURRENCE_PATTERN = /^occurrence:v0:[0-9a-f]{64}$/;

function isLegacyIdentityShape(stored: StoredIdentityRow): boolean {
  return (
    stored.identityVersion === 0 &&
    LEGACY_STABLE_KEY_PATTERN.test(stored.stableKey) &&
    FINDING_TYPE_SET.has(stored.family) &&
    stored.subtype === "legacy" &&
    stored.detectorId === "legacy-backfill" &&
    stored.detectorVersion === "0" &&
    stored.policyId === null &&
    stored.policyVersion === null &&
    stored.subjectIds.length === 0 &&
    isSafeStorageString(stored.semanticKey, 512)
  );
}

function isLegacyOccurrenceShape(stored: StoredOccurrenceRow): boolean {
  return (
    stored.identityVersion === 0 &&
    LEGACY_OCCURRENCE_PATTERN.test(stored.occurrenceId) &&
    LEGACY_STABLE_KEY_PATTERN.test(stored.stableKey) &&
    LEGACY_EVIDENCE_KEY_PATTERN.test(stored.evidenceRevisionKey)
  );
}

function canonicalMetadataJson(metadata: Record<string, SafeMetadataValue>): string {
  const ordered: Record<string, SafeMetadataValue> = {};
  for (const key of Object.keys(metadata).sort((left, right) => left.localeCompare(right))) {
    const value = metadata[key];
    if (value !== undefined) ordered[key] = value;
  }
  return JSON.stringify(ordered);
}

function sameIntegrityEventContent(
  persisted: IntegrityEvent,
  incoming: NewIntegrityEvent
): boolean {
  return (
    persisted.id === incoming.id &&
    persisted.schemaVersion === incoming.schemaVersion &&
    persisted.category === incoming.category &&
    persisted.kind === incoming.kind &&
    persisted.occurredAt === incoming.occurredAt &&
    (persisted.scanId ?? null) === (incoming.scanId ?? null) &&
    (persisted.stableKey ?? null) === (incoming.stableKey ?? null) &&
    (persisted.occurrenceId ?? null) === (incoming.occurrenceId ?? null) &&
    (persisted.proposalId ?? null) === (incoming.proposalId ?? null) &&
    (persisted.approvalId ?? null) === (incoming.approvalId ?? null) &&
    canonicalMetadataJson(persisted.safeMetadata) === canonicalMetadataJson(incoming.safeMetadata)
  );
}

function toReviewDispositionRecord(row: unknown[]): ReviewDispositionRecord | null {
  const [
    id,
    stableKey,
    sourceOccurrenceId,
    sourceEvidenceRevisionKey,
    kind,
    reason,
    createdAt,
    untilAt,
    untilEvidenceChanges,
    restoresDispositionId
  ] = row;
  if (
    typeof id !== "string" ||
    typeof stableKey !== "string" ||
    typeof sourceOccurrenceId !== "string" ||
    typeof sourceEvidenceRevisionKey !== "string" ||
    typeof kind !== "string" ||
    !REVIEW_DISPOSITION_KIND_SET.has(kind) ||
    (typeof reason !== "string" && reason !== null) ||
    typeof createdAt !== "string" ||
    (typeof untilAt !== "string" && untilAt !== null) ||
    (untilEvidenceChanges !== 0 && untilEvidenceChanges !== 1) ||
    (typeof restoresDispositionId !== "string" && restoresDispositionId !== null)
  ) {
    return null;
  }
  return {
    id,
    stableKey,
    sourceOccurrenceId,
    sourceEvidenceRevisionKey,
    kind: kind as ReviewDispositionKind,
    reason,
    createdAt,
    untilAt,
    untilEvidenceChanges: untilEvidenceChanges === 1,
    restoresDispositionId
  };
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
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string" && validateTraceMetadata(item))
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function safeMetadata(value: string): Record<string, string | number | boolean> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const metadata: Record<string, string | number | boolean> = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (
        (typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") ||
        !validateTraceMetadata(key) ||
        !validateTraceMetadata(item)
      )
        return null;
      metadata[key] = item;
    }
    return metadata;
  } catch {
    return null;
  }
}

function durationBetween(startedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function numericAttribute(
  attributes: Record<string, string | number | boolean>,
  key: string
): number {
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

function calculateLocalPercentile(values: readonly number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1)] ?? null;
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
    const payload = JSON.parse(payloadJson) as unknown;
    if (!isRecord(payload)) return { confidence: 0 };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEvidence(value: unknown): value is EvidenceRef {
  return (
    isRecord(value) &&
    typeof value.notePath === "string" &&
    typeof value.locator === "string" &&
    typeof value.excerpt === "string"
  );
}

function isFindingType(value: string): value is FindingType {
  return FINDING_TYPE_SET.has(value);
}

function isFindingSeverity(value: string): value is FindingSeverity {
  return FINDING_SEVERITY_SET.has(value);
}

function isFindingStatus(value: string): value is FindingStatus {
  return FINDING_STATUS_SET.has(value);
}
