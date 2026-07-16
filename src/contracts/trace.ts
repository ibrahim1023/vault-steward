export type TraceSpan = {
  schemaVersion: 1;
  id: string;
  scanId: string;
  parentSpanId?: string;
  kind: string;
  startedAt: string;
  completedAt?: string;
  outcome: "success" | "failure";
  correlationId: string;
  attributes: Record<string, string | number | boolean>;
};
export type AgentExecutionTrace = {
  schemaVersion: 1;
  id: string;
  scanId: string;
  spanId: string;
  agent: string;
  model: string;
  durationMs: number;
  retryCount: number;
  validation: "passed" | "failed";
  correlationId: string;
};
export type FindingLineage = {
  schemaVersion: 1;
  findingId: string;
  scanId: string;
  evidenceLocators: string[];
  parsedArtifactIds: string[];
  validatorId: string;
  coordinatorDecisionId: string;
  agentExecutionId?: string;
  retrievalMetadata?: readonly string[];
  policyEvaluationId?: string;
  proposalSourceId?: string;
  correlationId: string;
};

export type TracePreferences = {
  retentionDays: number;
  storePromptSnapshots: boolean;
  storeModelOutputSnapshots: boolean;
  redactExcerpts: boolean;
  excludedFolders: readonly string[];
};

const FORBIDDEN = [/\n/, /\r/, /https?:\/\//i, /\/Users\//, /prompt/i, /secret/i];

export function validateTraceMetadata(value: unknown): boolean {
  if (typeof value === "string")
    return value.length <= 256 && !FORBIDDEN.some((pattern) => pattern.test(value));
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(validateTraceMetadata);
  if (value && typeof value === "object")
    return Object.entries(value).every(
      ([key, item]) => validateTraceMetadata(key) && validateTraceMetadata(item)
    );
  return false;
}

export function validateFindingLineage(lineage: FindingLineage): boolean {
  return (
    lineage.schemaVersion === 1 &&
    lineage.findingId.length > 0 &&
    lineage.scanId.length > 0 &&
    lineage.evidenceLocators.length > 0 &&
    lineage.parsedArtifactIds.length > 0 &&
    lineage.validatorId.length > 0 &&
    lineage.coordinatorDecisionId.length > 0 &&
    validateTraceMetadata(lineage)
  );
}

export function validateTracePreferences(value: unknown): value is TracePreferences {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<TracePreferences>;
  if (
    !Number.isInteger(candidate.retentionDays) ||
    candidate.retentionDays === undefined ||
    candidate.retentionDays < 1 ||
    candidate.retentionDays > 3650 ||
    typeof candidate.storePromptSnapshots !== "boolean" ||
    typeof candidate.storeModelOutputSnapshots !== "boolean" ||
    typeof candidate.redactExcerpts !== "boolean" ||
    !Array.isArray(candidate.excludedFolders) ||
    candidate.excludedFolders.length > 100
  )
    return false;

  if (
    (candidate.storePromptSnapshots || candidate.storeModelOutputSnapshots) &&
    !candidate.redactExcerpts
  )
    return false;

  return candidate.excludedFolders.every(
    (folder) =>
      typeof folder === "string" &&
      folder.length > 0 &&
      folder.length <= 240 &&
      !folder.includes("\\") &&
      !folder.split("/").some((segment) => segment === "" || segment === "." || segment === "..") &&
      !FORBIDDEN.some((pattern) => pattern.test(folder))
  );
}
