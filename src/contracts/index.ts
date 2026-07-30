export const FINDING_TYPES = [
  "broken-reference",
  "invalid-reference",
  "reference-normalization",
  "entity-alias",
  "contradiction",
  "staleness",
  "task",
  "schema",
  "decision",
  "policy"
] as const;

export type FindingType = (typeof FINDING_TYPES)[number];
export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "dismissed" | "approved" | "applied" | "stale";

export type EvidenceRef = {
  notePath: string;
  locator: string;
  excerpt: string;
};

export type SuggestedFix = {
  description: string;
};

export type Finding = {
  schemaVersion: 1;
  id: string;
  scanId: string;
  type: FindingType;
  severity: FindingSeverity;
  evidence: EvidenceRef[];
  affectedNoteIds: string[];
  violatedPolicyId?: string;
  explanation: string;
  suggestedFixes: SuggestedFix[];
  confidence: number;
  status: FindingStatus;
};

export type AgentName = "entity" | "contradiction" | "staleness" | "task" | "decision";

export type AgentRequest = {
  schemaVersion: 1;
  scanId: string;
  agent: AgentName;
  evidence: { entries: EvidenceRef[] };
  policyContext: { policyIds: string[] };
  budget: { maxInputTokens: number; maxOutputTokens: number; timeoutMs: number };
};

export type AgentCandidate = {
  schemaVersion: 1;
  candidateFindings: Array<Pick<Finding, "type" | "evidence" | "explanation" | "confidence">>;
  incomplete: boolean;
  limitations: string[];
};

export type VaultStewardError = {
  code: string;
  message: string;
  correlationId: string;
  retryable: boolean;
  cause?: string;
};

export type ToolResult<T> =
  | { ok: true; value: T; correlationId: string }
  | { ok: false; error: VaultStewardError; correlationId: string };

export * from "./prepared-repair.js";
export * from "./reference-repair.js";
