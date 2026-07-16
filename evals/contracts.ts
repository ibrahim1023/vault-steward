export const EVALUATION_SPLITS = [
  "development",
  "ci-regression",
  "held-out",
  "adversarial",
  "human-review"
] as const;
export const EVALUATION_FAMILIES = [
  "reference",
  "entity",
  "contradiction",
  "staleness",
  "task",
  "schema",
  "policy",
  "decision"
] as const;

export type EvaluationSplit = (typeof EVALUATION_SPLITS)[number];
export type EvaluationFamily = (typeof EVALUATION_FAMILIES)[number];
export type ExpectedEvaluationFinding = {
  id: string;
  type: string;
  notePath: string;
  locator: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  safeFix: "applicable" | "not-applicable";
};
export type EvaluationCase = {
  schemaVersion: 1;
  id: string;
  family: EvaluationFamily;
  split: EvaluationSplit;
  agent?: string;
  fixturePath: string;
  expected: ExpectedEvaluationFinding[];
  contamination: { developmentVisible: boolean; reason: string };
  humanLabel?: { labelId: string; adjudicated: boolean };
};
export type EvaluationReport = {
  schemaVersion: 1;
  reportId: string;
  createdAt: string;
  selection: { suite: string; caseIds: string[]; splits: EvaluationSplit[]; agent?: string; modelProfile?: string };
  provenance: { pluginVersion: string; parserVersion: string; graderVersion: string; fixtureManifestHash: string; configurationFingerprint: string; hardware: { platform: string; architecture: string; memoryBytes: number; runtime: string } };
  metrics: { precision: number | null; recall: number | null; f1: number | null; falsePositives: number; falseNegatives: number; [key: string]: number | null };
  cases: Array<{ id: string; outcome: "passed" | "failed" | "incomplete"; durationMs: number; errorCode: string | null }>;
};

const FORBIDDEN = [/\n/, /\r/, /https?:\/\//i, /\/Users\//, /prompt/i, /secret/i, /note body/i, /raw output/i];

export function validateEvaluationCase(value: unknown): value is EvaluationCase {
  if (!isObject(value)) return false;
  const item = value as Partial<EvaluationCase>;
  if (
    item.schemaVersion !== 1 ||
    !bounded(item.id) ||
    !EVALUATION_FAMILIES.includes(item.family as EvaluationFamily) ||
    !EVALUATION_SPLITS.includes(item.split as EvaluationSplit) ||
    !isFixturePath(item.fixturePath) ||
    !Array.isArray(item.expected) ||
    !isObject(item.contamination) ||
    typeof item.contamination.developmentVisible !== "boolean" ||
    !bounded(item.contamination.reason)
  )
    return false;
  if ((item.split === "held-out" || item.split === "human-review") && item.contamination.developmentVisible)
    return false;
  if (item.agent !== undefined && !bounded(item.agent)) return false;
  if (item.humanLabel !== undefined && (!isObject(item.humanLabel) || !bounded(item.humanLabel.labelId) || typeof item.humanLabel.adjudicated !== "boolean")) return false;
  return item.expected.every(validateExpectedFinding);
}

export function validateEvaluationReport(value: unknown): value is EvaluationReport {
  if (!isObject(value)) return false;
  const report = value as Partial<EvaluationReport>;
  if (
    report.schemaVersion !== 1 ||
    !bounded(report.reportId) ||
    !isIsoDate(report.createdAt) ||
    !isObject(report.selection) ||
    !bounded(report.selection.suite) ||
    !Array.isArray(report.selection.caseIds) ||
    !report.selection.caseIds.every(bounded) ||
    !Array.isArray(report.selection.splits) ||
    !report.selection.splits.every((split) => EVALUATION_SPLITS.includes(split)) ||
    !isObject(report.provenance) ||
    !isObject(report.metrics) ||
    !Array.isArray(report.cases)
  )
    return false;
  const provenance = report.provenance;
  return (
    bounded(provenance.pluginVersion) &&
    bounded(provenance.parserVersion) &&
    bounded(provenance.graderVersion) &&
    hash(provenance.fixtureManifestHash) &&
    hash(provenance.configurationFingerprint) &&
    isObject(provenance.hardware) &&
    bounded(provenance.hardware.platform) &&
    bounded(provenance.hardware.architecture) &&
    Number.isFinite(provenance.hardware.memoryBytes) &&
    provenance.hardware.memoryBytes >= 0 &&
    bounded(provenance.hardware.runtime) &&
    Object.values(report.metrics).every((metric) => metric === null || (typeof metric === "number" && Number.isFinite(metric))) &&
    report.cases.every((item) => isObject(item) && bounded(item.id) && ["passed", "failed", "incomplete"].includes(item.outcome as string) && Number.isFinite(item.durationMs) && item.durationMs >= 0 && (item.errorCode === null || bounded(item.errorCode)))
  );
}

function validateExpectedFinding(value: unknown): value is ExpectedEvaluationFinding {
  if (!isObject(value)) return false;
  return bounded(value.id) && bounded(value.type) && isRelativePath(value.notePath) && bounded(value.locator) && ["info", "low", "medium", "high", "critical"].includes(value.severity as string) && ["applicable", "not-applicable"].includes(value.safeFix as string);
}
function isFixturePath(value: unknown): boolean { return typeof value === "string" && value.startsWith("evals/cases/") && isRelativePath(value); }
function isRelativePath(value: unknown): boolean { return typeof value === "string" && value.length > 0 && value.length <= 240 && !value.includes("\\") && !value.split("/").some((part) => part === "" || part === "." || part === "..") && !FORBIDDEN.some((pattern) => pattern.test(value)); }
function bounded(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 256 && !FORBIDDEN.some((pattern) => pattern.test(value)); }
function hash(value: unknown): boolean { return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value); }
function isIsoDate(value: unknown): boolean { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function isObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
