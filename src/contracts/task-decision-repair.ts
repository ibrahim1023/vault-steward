export const TASK_REPAIR_KINDS = [
  "mark-complete",
  "replace-due-date",
  "assign-owner",
  "assign-project",
  "clear-abandoned",
  "resolve-duplicate-id"
] as const;

export const DECISION_REPAIR_KINDS = [
  "link-project",
  "link-related-decision",
  "set-rationale"
] as const;

export type TaskRepairKind = (typeof TASK_REPAIR_KINDS)[number];
export type DecisionRepairKind = (typeof DECISION_REPAIR_KINDS)[number];

export type TaskRepairIntent = {
  schemaVersion: 1;
  kind: TaskRepairKind;
  scanId: string;
  findingId: string;
  taskId: string;
  candidateId?: string;
};

export type DecisionRepairIntent = {
  schemaVersion: 1;
  kind: DecisionRepairKind;
  scanId: string;
  findingId: string;
  decisionId: string;
  candidateId?: string;
  rationale?: string;
  evidenceIds?: string[];
};

export type TaskRepairIntentParseResult =
  { ok: true; value: TaskRepairIntent } | { ok: false; diagnostics: string[] };
export type DecisionRepairIntentParseResult =
  { ok: true; value: DecisionRepairIntent } | { ok: false; diagnostics: string[] };

const CANDIDATE_TASK_KINDS = new Set<TaskRepairKind>([
  "replace-due-date",
  "assign-owner",
  "assign-project",
  "resolve-duplicate-id"
]);

export function parseTaskRepairIntent(value: unknown): TaskRepairIntentParseResult {
  if (!isRecord(value)) return invalidTask("task repair intent must be an object");
  const diagnostics = unknownFields(value, [
    "schemaVersion",
    "kind",
    "scanId",
    "findingId",
    "taskId",
    "candidateId"
  ]);
  if (value.schemaVersion !== 1) diagnostics.push("intent schemaVersion must be 1");
  if (!TASK_REPAIR_KINDS.includes(value.kind as TaskRepairKind))
    diagnostics.push("task repair kind is unsupported");
  for (const field of ["scanId", "findingId", "taskId"] as const) {
    if (!isBoundedId(value[field])) diagnostics.push(`intent ${field} is invalid`);
  }
  const kind = value.kind as TaskRepairKind;
  if (CANDIDATE_TASK_KINDS.has(kind)) {
    if (!isBoundedId(value.candidateId)) diagnostics.push("intent candidateId is required");
  } else if (value.candidateId !== undefined) {
    diagnostics.push("intent candidateId is not allowed for this repair kind");
  }
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          kind,
          scanId: value.scanId as string,
          findingId: value.findingId as string,
          taskId: value.taskId as string,
          ...(typeof value.candidateId === "string" ? { candidateId: value.candidateId } : {})
        }
      };
}

export function parseDecisionRepairIntent(value: unknown): DecisionRepairIntentParseResult {
  if (!isRecord(value)) return invalidDecision("decision repair intent must be an object");
  const diagnostics = unknownFields(value, [
    "schemaVersion",
    "kind",
    "scanId",
    "findingId",
    "decisionId",
    "candidateId",
    "rationale",
    "evidenceIds"
  ]);
  if (value.schemaVersion !== 1) diagnostics.push("intent schemaVersion must be 1");
  if (!DECISION_REPAIR_KINDS.includes(value.kind as DecisionRepairKind))
    diagnostics.push("decision repair kind is unsupported");
  for (const field of ["scanId", "findingId", "decisionId"] as const) {
    if (!isBoundedId(value[field])) diagnostics.push(`intent ${field} is invalid`);
  }
  const kind = value.kind as DecisionRepairKind;
  if (kind === "set-rationale") {
    if (!isSafeRationale(value.rationale)) diagnostics.push("intent rationale is invalid");
    if (!isEvidenceIds(value.evidenceIds)) diagnostics.push("intent evidenceIds are invalid");
    if (value.candidateId !== undefined)
      diagnostics.push("rationale intent cannot include candidateId");
  } else {
    if (!isBoundedId(value.candidateId)) diagnostics.push("intent candidateId is required");
    if (value.rationale !== undefined || value.evidenceIds !== undefined)
      diagnostics.push("link intent cannot include rationale data");
  }
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          kind,
          scanId: value.scanId as string,
          findingId: value.findingId as string,
          decisionId: value.decisionId as string,
          ...(typeof value.candidateId === "string" ? { candidateId: value.candidateId } : {}),
          ...(typeof value.rationale === "string" ? { rationale: value.rationale } : {}),
          ...(Array.isArray(value.evidenceIds)
            ? { evidenceIds: value.evidenceIds as string[] }
            : {})
        }
      };
}

function isSafeRationale(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 60 || value.length > 600) return false;
  if (/[\r\n]|\[.+?\]\(.+?\)|[\\/]/.test(value)) return false;
  if (/(ignore\s+(all\s+)?previous|system\s*:|\[inst\]|<\/|tool\s*:)/i.test(value)) return false;
  const sentences = value.match(/[.!?](?:\s|$)/g)?.length ?? 0;
  return sentences >= 1 && sentences <= 3;
}

function isEvidenceIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 8 &&
    value.every(isBoundedId) &&
    new Set(value).size === value.length
  );
}

function isBoundedId(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\r\n\0]/.test(value)
  );
}

function unknownFields(value: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `intent has unknown field '${key}'`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidTask(diagnostic: string): TaskRepairIntentParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}

function invalidDecision(diagnostic: string): DecisionRepairIntentParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}
