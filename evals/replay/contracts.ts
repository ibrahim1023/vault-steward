import type { EvaluationReport } from "../contracts.js";

export const REPLAY_VARIABLES = [
  "model",
  "prompt",
  "threshold",
  "retrieval",
  "policy",
  "agent"
] as const;

export type ReplayVariable = (typeof REPLAY_VARIABLES)[number];

export type ReplayIneligibilityReason =
  | "missing-scan-snapshot"
  | "missing-input-hash"
  | "missing-parser-version"
  | "missing-configuration-fingerprint"
  | "missing-trace-fingerprint"
  | "unavailable-source-content";

export type LiveReplayEligibility =
  | { eligible: true; scanId: string; source: "retained-fixture" }
  | { eligible: false; scanId: string; reasons: ReplayIneligibilityReason[] };

export type RedactedReplayCaseResult = {
  id: string;
  outcome: "passed" | "failed" | "incomplete";
  durationMs: number;
  errorCode: string | null;
};

export type RedactedRuntimeMetrics = {
  totalDurationMs: number;
  peakMemoryBytes: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type FixtureReplayRecord = {
  schemaVersion: 1;
  replayId: string;
  sourceReportId: string;
  fixtureManifestHash: string;
  configuration: Record<ReplayVariable, string>;
  caseResults: RedactedReplayCaseResult[];
  metrics: EvaluationReport["metrics"];
  runtime: RedactedRuntimeMetrics;
};

const FORBIDDEN = [
  /\n/,
  /\r/,
  /https?:\/\//i,
  /^\//,
  /\/(?:Users|etc|private|tmp)\//i,
  /\bsecret\b/i,
  /\bnote body\b/i,
  /\braw output\b/i,
  /\bsummary\b/i,
  /\bcontents\b/i
];

const REPLAY_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ERROR_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;

export function validateFixtureReplayRecord(value: unknown): value is FixtureReplayRecord {
  if (!isObject(value)) return false;
  const record = value as Partial<FixtureReplayRecord>;
  return (
    record.schemaVersion === 1 &&
    metadataLabel(record.replayId) &&
    metadataLabel(record.sourceReportId) &&
    hash(record.fixtureManifestHash) &&
    validateReplayConfiguration(record.configuration) &&
    Array.isArray(record.caseResults) &&
    record.caseResults.every(validateReplayCaseResult) &&
    validateMetrics(record.metrics) &&
    validateRuntime(record.runtime)
  );
}

function validateReplayConfiguration(
  value: unknown
): value is Record<ReplayVariable, string> {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === REPLAY_VARIABLES.length &&
    REPLAY_VARIABLES.every((key) => metadataLabel(value[key])) &&
    keys.every((key) => REPLAY_VARIABLES.includes(key as ReplayVariable))
  );
}

function validateReplayCaseResult(value: unknown): value is RedactedReplayCaseResult {
  if (!isObject(value)) return false;
  return (
    replayToken(value.id) &&
    ["passed", "failed", "incomplete"].includes(value.outcome as string) &&
    nonNegativeNumber(value.durationMs) &&
    (value.errorCode === null || errorCode(value.errorCode))
  );
}

function validateMetrics(value: unknown): value is EvaluationReport["metrics"] {
  if (!isObject(value)) return false;
  const metrics = Object.values(value);
  return metrics.length > 0 && metrics.every((metric) => metric === null || finiteNumber(metric));
}

function validateRuntime(value: unknown): value is RedactedRuntimeMetrics {
  if (!isObject(value)) return false;
  return (
    nonNegativeNumber(value.totalDurationMs) &&
    nonNegativeNumber(value.peakMemoryBytes) &&
    nullableNonNegativeNumber(value.inputTokens) &&
    nullableNonNegativeNumber(value.outputTokens)
  );
}

function bounded(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !FORBIDDEN.some((pattern) => pattern.test(value))
  );
}

function metadataLabel(value: unknown): value is string {
  return bounded(value) && REPLAY_TOKEN_PATTERN.test(value);
}

function replayToken(value: unknown): value is string {
  return bounded(value) && REPLAY_TOKEN_PATTERN.test(value);
}

function errorCode(value: unknown): value is string {
  return bounded(value) && ERROR_CODE_PATTERN.test(value);
}

function hash(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonNegativeNumber(value: unknown): value is number {
  return finiteNumber(value) && value >= 0;
}

function nullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || nonNegativeNumber(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
