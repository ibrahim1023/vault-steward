export const RELEASE_CASE_LABELS = ["positive", "hard-negative", "abstention"] as const;
export const RELEASE_DECISIONS = ["finding", "abstain"] as const;
export const RELEASE_REPAIR_ELIGIBILITY = ["eligible", "ineligible", "abstain"] as const;
export const RELEASE_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

export type ReleaseCaseLabel = (typeof RELEASE_CASE_LABELS)[number];
export type ReleaseDecision = (typeof RELEASE_DECISIONS)[number];
export type ReleaseRepairEligibility = (typeof RELEASE_REPAIR_ELIGIBILITY)[number];
export type ReleaseSeverity = (typeof RELEASE_SEVERITIES)[number];

export type ReleaseEvidenceRange = {
  id: string;
  notePath: string;
  startLine: number;
  endLine: number;
};

export type ReleaseCorpusCase = {
  schemaVersion: 1;
  id: string;
  family: string;
  label: ReleaseCaseLabel;
  task: string;
  evidence: ReleaseEvidenceRange[];
  candidateTargets: Array<{ id: string; notePath: string }>;
  expected: {
    decision: ReleaseDecision;
    findingType: string | null;
    severity: ReleaseSeverity | null;
    citedEvidenceIds: string[];
    repairEligibility: ReleaseRepairEligibility;
    candidateTargetId: string | null;
  };
};

export type ReleaseCorpus = {
  schemaVersion: 1;
  id: string;
  persona: string;
  fixtureRoot: string;
  cases: ReleaseCorpusCase[];
};

export type ReleaseModelDecision = {
  decision: ReleaseDecision;
  citedEvidenceIds: string[];
  repairEligibility: ReleaseRepairEligibility;
  candidateTargetId: string | null;
};

export type ReleaseProviderReport = {
  schemaVersion: 1;
  reportId: string;
  createdAt: string;
  corpusId: string;
  corpusFingerprint: string;
  provider: "ollama" | "openai";
  model: string;
  status: "passed" | "failed" | "incomplete";
  thresholds: {
    precision: number;
    recall: number;
    f1: number;
    evidenceValidity: number;
    unsupportedFindingRate: number;
    safeRepairValidity: number;
    incompleteScans: number;
    unsafeRemediations: number;
  };
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    evidenceValidity: number;
    unsupportedFindingRate: number;
    safeRepairValidity: number;
    medianLatencyMs: number;
    p95LatencyMs: number;
    retries: number;
    incompleteCases: number;
    incompleteScans: number;
    unsafeRemediations: number;
  };
  cases: Array<{
    id: string;
    outcome: "passed" | "failed" | "incomplete";
    durationMs: number;
    retries: number;
    errorCode: string | null;
  }>;
};

const SAFE_TEXT = /^[a-z0-9][a-z0-9._:/ -]{0,255}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

export function validateReleaseCorpus(value: unknown): value is ReleaseCorpus {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== 1 ||
    !isSafeId(value.id) ||
    !isSafeText(value.persona) ||
    !isFixtureRoot(value.fixtureRoot) ||
    !Array.isArray(value.cases) ||
    value.cases.length < 20 ||
    value.cases.length > 100 ||
    !value.cases.every(validateReleaseCase)
  )
    return false;
  return new Set(value.cases.map((item) => item.id)).size === value.cases.length;
}

export function createReleaseDecisionValidator(
  item: ReleaseCorpusCase
): (value: unknown) => value is ReleaseModelDecision {
  const evidenceIds = new Set(item.evidence.map((evidence) => evidence.id));
  const candidateIds = new Set(item.candidateTargets.map((candidate) => candidate.id));
  return (value: unknown): value is ReleaseModelDecision => {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "decision",
        "citedEvidenceIds",
        "repairEligibility",
        "candidateTargetId"
      ])
    )
      return false;
    if (
      !RELEASE_DECISIONS.includes(value.decision as ReleaseDecision) ||
      !RELEASE_REPAIR_ELIGIBILITY.includes(value.repairEligibility as ReleaseRepairEligibility) ||
      !Array.isArray(value.citedEvidenceIds) ||
      !value.citedEvidenceIds.every((id) => typeof id === "string" && evidenceIds.has(id)) ||
      new Set(value.citedEvidenceIds).size !== value.citedEvidenceIds.length
    )
      return false;
    if (value.decision === "abstain") {
      return (
        value.citedEvidenceIds.length === 0 &&
        value.repairEligibility === "abstain" &&
        value.candidateTargetId === null
      );
    }
    return (
      value.citedEvidenceIds.length > 0 &&
      (value.candidateTargetId === null ||
        (typeof value.candidateTargetId === "string" &&
          candidateIds.has(value.candidateTargetId))) &&
      (value.repairEligibility !== "eligible" || value.candidateTargetId !== null)
    );
  };
}

export function validateReleaseProviderReport(value: unknown): value is ReleaseProviderReport {
  if (!isRecord(value) || !isRecord(value.thresholds) || !isRecord(value.metrics)) return false;
  return (
    value.schemaVersion === 1 &&
    isSafeId(value.reportId) &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    isSafeId(value.corpusId) &&
    typeof value.corpusFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(value.corpusFingerprint) &&
    (value.provider === "ollama" || value.provider === "openai") &&
    isSafeText(value.model) &&
    ["passed", "failed", "incomplete"].includes(value.status as string) &&
    Object.values(value.thresholds).every(isFiniteNonNegative) &&
    Object.values(value.metrics).every(isFiniteNonNegative) &&
    Array.isArray(value.cases) &&
    value.cases.every(
      (item) =>
        isRecord(item) &&
        isSafeId(item.id) &&
        ["passed", "failed", "incomplete"].includes(item.outcome as string) &&
        isFiniteNonNegative(item.durationMs) &&
        Number.isInteger(item.retries) &&
        (item.errorCode === null || isSafeId(item.errorCode))
    )
  );
}

function validateReleaseCase(value: unknown): value is ReleaseCorpusCase {
  if (!isRecord(value) || !isRecord(value.expected)) return false;
  if (
    value.schemaVersion !== 1 ||
    !isSafeId(value.id) ||
    !isSafeText(value.family) ||
    !RELEASE_CASE_LABELS.includes(value.label as ReleaseCaseLabel) ||
    !isSafeTask(value.task) ||
    !Array.isArray(value.evidence) ||
    value.evidence.length === 0 ||
    value.evidence.length > 8 ||
    !value.evidence.every(validateEvidenceRange) ||
    new Set(value.evidence.map((item) => (item as ReleaseEvidenceRange).id)).size !==
      value.evidence.length ||
    !Array.isArray(value.candidateTargets) ||
    value.candidateTargets.length > 12 ||
    !value.candidateTargets.every(validateCandidate)
  )
    return false;
  const expected = value.expected;
  const evidenceIds = new Set(value.evidence.map((item) => (item as ReleaseEvidenceRange).id));
  const candidateIds = new Set(value.candidateTargets.map((item) => (item as { id: string }).id));
  if (
    !RELEASE_DECISIONS.includes(expected.decision as ReleaseDecision) ||
    !Array.isArray(expected.citedEvidenceIds) ||
    !expected.citedEvidenceIds.every((id) => typeof id === "string" && evidenceIds.has(id)) ||
    !RELEASE_REPAIR_ELIGIBILITY.includes(expected.repairEligibility as ReleaseRepairEligibility)
  )
    return false;
  if (value.label === "positive") {
    return (
      expected.decision === "finding" &&
      isSafeText(expected.findingType) &&
      RELEASE_SEVERITIES.includes(expected.severity as ReleaseSeverity) &&
      expected.citedEvidenceIds.length > 0 &&
      (expected.candidateTargetId === null ||
        (typeof expected.candidateTargetId === "string" &&
          candidateIds.has(expected.candidateTargetId))) &&
      (expected.repairEligibility !== "eligible" || expected.candidateTargetId !== null)
    );
  }
  return (
    expected.decision === "abstain" &&
    expected.findingType === null &&
    expected.severity === null &&
    expected.citedEvidenceIds.length === 0 &&
    expected.repairEligibility === "abstain" &&
    expected.candidateTargetId === null
  );
}

function validateEvidenceRange(value: unknown): value is ReleaseEvidenceRange {
  return (
    isRecord(value) &&
    isSafeId(value.id) &&
    isRelativeMarkdownPath(value.notePath) &&
    Number.isInteger(value.startLine) &&
    Number.isInteger(value.endLine) &&
    (value.startLine as number) > 0 &&
    (value.endLine as number) >= (value.startLine as number) &&
    (value.endLine as number) - (value.startLine as number) <= 40
  );
}

function validateCandidate(value: unknown): boolean {
  return isRecord(value) && isSafeId(value.id) && isRelativeMarkdownPath(value.notePath);
}

function isFixtureRoot(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.startsWith("fixtures/") &&
    !value.includes("\\") &&
    !value.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

function isRelativeMarkdownPath(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.endsWith(".md") &&
    value.length <= 240 &&
    !value.includes("\\") &&
    !value.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function isSafeText(value: unknown): value is string {
  return typeof value === "string" && SAFE_TEXT.test(value) && !/secret|api key/i.test(value);
}

function isSafeTask(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\r\n]/.test(value) &&
    !/https?:\/\/|secret|api key|raw output/i.test(value)
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
