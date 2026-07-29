import { createHash } from "node:crypto";

import type { Finding, FindingType } from "../../src/contracts/index.js";
import { runGovernedScan } from "../../src/core/governed-scan.js";
import type {
  LocalGeneration,
  LocalGenerationRequest,
  ModelProvider
} from "../../src/model-provider/local-provider.js";
import type { Policy } from "../../src/policy/parse.js";
import {
  buildReferenceTargetCandidates,
  recommendReferenceRepair,
  selectReferenceCandidateWithProviders,
  type ReferenceRepairRecommendation
} from "../../src/review/reference-recommendation.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";
import type { VaultFile } from "../../src/vault-adapter/types.js";
import { type ReleaseCorpus, type ReleaseProviderReport } from "./contracts.js";
import type { LoadedReleaseCase } from "./load.js";

const RELEASE_NOW = "2026-07-29T00:00:00.000Z";
const THRESHOLDS: ReleaseProviderReport["thresholds"] = {
  precision: 0.9,
  recall: 0.85,
  f1: 0.87,
  evidenceValidity: 1,
  unsupportedFindingRate: 0.05,
  safeRepairValidity: 1,
  incompleteScans: 0,
  unsafeRemediations: 0
};
const RELEASE_POLICIES: readonly Policy[] = [
  {
    id: "northstar-release-owner",
    version: 1,
    enabled: true,
    rules: [
      {
        id: "project-owner-required",
        fact: "project.owner",
        operator: "required",
        severity: "high"
      }
    ]
  }
];

type InstrumentedProvider = {
  provider: ModelProvider;
  invocations: Array<{ durationMs: number; succeeded: boolean }>;
};

type EvaluatedRepair = {
  recommendation: ReferenceRepairRecommendation;
  incomplete: boolean;
  attempted: true;
  durationMs: number;
};

export async function evaluateReleaseProvider(input: {
  corpus: ReleaseCorpus;
  cases: readonly LoadedReleaseCase[];
  files: readonly VaultFile[];
  provider: ModelProvider;
  corpusFingerprint: string;
  now?: () => Date;
}): Promise<ReleaseProviderReport> {
  const instrumented = instrumentProvider(input.provider);
  const snapshot = scanVaultFiles(input.files);
  const scanStartedAt = performance.now();
  const scan = await runGovernedScan(input.files, [instrumented.provider], RELEASE_NOW, {
    snapshot,
    policies: RELEASE_POLICIES
  });
  const scanDurationMs = Math.round(performance.now() - scanStartedAt);

  if (!scan.completed) {
    return buildIncompleteReport(input, instrumented, scanDurationMs, scan.limitations[0] ?? null);
  }

  const repairs = await evaluateRepairs(
    input.cases,
    scan.findings,
    snapshot,
    instrumented.provider
  );
  const evaluations = input.cases.map((loaded) =>
    evaluateCase(loaded, scan.findings, repairs.get(loaded.item.id))
  );
  const positive = evaluations.filter(({ loaded }) => loaded.item.label === "positive");
  const truePositives = positive.filter(({ finding }) => finding !== null);
  const matchedFindingIds = new Set(truePositives.map(({ finding }) => finding!.id));
  const falsePositiveFindings = scan.findings.filter(
    (finding) =>
      !matchedFindingIds.has(finding.id) &&
      !input.cases.some(
        (loaded) => loaded.item.label === "positive" && matchesExpectedFinding(loaded, finding)
      )
  );
  const precision = ratio(
    truePositives.length,
    truePositives.length + falsePositiveFindings.length
  );
  const recall = ratio(truePositives.length, positive.length);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const evidenceValidity = ratio(
    truePositives.filter(({ evidenceMatches }) => evidenceMatches).length,
    truePositives.length
  );
  const repairCases = positive.filter(
    ({ loaded }) => loaded.item.expected.repairEligibility === "eligible"
  );
  const safeRepairMatches = repairCases.filter(({ repairMatches }) => repairMatches).length;
  const unsafeRemediations = [...repairs.entries()].filter(([caseId, result]) => {
    const loaded = input.cases.find((item) => item.item.id === caseId);
    return (
      loaded?.item.expected.repairEligibility !== "eligible" &&
      result.recommendation.status !== "abstained"
    );
  }).length;
  const incompleteCases = evaluations.filter(({ incomplete }) => incomplete).length;
  const failedCases = evaluations.filter(({ passed: passedCase, incomplete }) => {
    return !passedCase && !incomplete;
  }).length;
  const expectedModelOperations =
    scan.semanticAnalysis.routes.length +
    [...repairs.values()].filter((result) => result.attempted).length;
  const latencies = instrumented.invocations.map((item) => item.durationMs);
  const metrics: ReleaseProviderReport["metrics"] = {
    precision,
    recall,
    f1,
    evidenceValidity,
    unsupportedFindingRate: ratio(
      falsePositiveFindings.length,
      truePositives.length + falsePositiveFindings.length
    ),
    safeRepairValidity: ratio(safeRepairMatches, repairCases.length),
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    retries: Math.max(0, instrumented.invocations.length - expectedModelOperations),
    incompleteCases,
    incompleteScans: incompleteCases > 0 ? 1 : 0,
    unsafeRemediations
  };
  const passed = failedCases === 0 && meetsThresholds(metrics);
  return createReport(input, {
    status: incompleteCases > 0 ? "incomplete" : passed ? "passed" : "failed",
    metrics,
    execution: {
      scanDurationMs,
      modelInvocations: instrumented.invocations.length,
      deterministicFindingCount: scan.findings.filter(isDeterministicFinding).length,
      semanticFindingCount: scan.findings.filter((finding) => !isDeterministicFinding(finding))
        .length,
      repairRecommendations: [...repairs.values()].filter(
        ({ recommendation }) => recommendation.status !== "abstained"
      ).length
    },
    cases: evaluations.map(({ loaded, passed: passedCase, incomplete, durationMs }) => ({
      id: loaded.item.id,
      outcome: incomplete ? "incomplete" : passedCase ? "passed" : "failed",
      durationMs,
      retries: 0,
      errorCode: incomplete ? "provider-unavailable" : passedCase ? null : "label-mismatch"
    }))
  });
}

export function assertReleaseReports(
  reports: readonly ReleaseProviderReport[],
  expectedFingerprint: string
): void {
  for (const provider of ["ollama", "openai"] as const) {
    const report = reports.find((item) => item.provider === provider);
    if (!report) throw new Error(`Missing ${provider} release report.`);
    if (report.corpusFingerprint !== expectedFingerprint)
      throw new Error(`${provider} release report uses a different corpus.`);
    if (report.status !== "passed") throw new Error(`${provider} release report did not pass.`);
    if (!meetsThresholds(report.metrics))
      throw new Error(`${provider} release thresholds did not pass.`);
  }
}

async function evaluateRepairs(
  cases: readonly LoadedReleaseCase[],
  findings: readonly Finding[],
  snapshot: ReturnType<typeof scanVaultFiles>,
  provider: ModelProvider
): Promise<Map<string, EvaluatedRepair>> {
  const results = new Map<string, EvaluatedRepair>();
  for (const finding of findings) {
    if (finding.type !== "broken-reference") continue;
    const loaded = cases.find((item) => caseCoversFinding(item, finding));
    if (!loaded) continue;
    const candidates = buildReferenceTargetCandidates({ finding, snapshot });
    if (candidates.length === 0) continue;
    const startedAt = performance.now();
    const recommendation = await recommendReferenceRepair({
      finding,
      scanId: snapshot.id,
      candidates,
      selectCandidate: (request) => selectReferenceCandidateWithProviders([provider], request)
    });
    results.set(loaded.item.id, {
      recommendation,
      incomplete:
        recommendation.status === "abstained" &&
        recommendation.reason === "The configured model provider could not rank repair targets.",
      attempted: true,
      durationMs: Math.round(performance.now() - startedAt)
    });
  }
  return results;
}

function evaluateCase(
  loaded: LoadedReleaseCase,
  findings: readonly Finding[],
  repair: EvaluatedRepair | undefined
): {
  loaded: LoadedReleaseCase;
  finding: Finding | null;
  evidenceMatches: boolean;
  repairMatches: boolean;
  passed: boolean;
  incomplete: boolean;
  durationMs: number;
} {
  const finding =
    findings.find((candidate) =>
      loaded.item.label === "positive"
        ? matchesExpectedFinding(loaded, candidate)
        : matchesCaseSubject(loaded, candidate)
    ) ?? null;
  const evidenceMatches =
    finding !== null &&
    sameSet(loaded.item.expected.citedEvidenceIds, citedEvidenceIds(loaded, finding));
  const repairMatches = matchesRepair(loaded, repair?.recommendation);
  const passed =
    loaded.item.label === "positive"
      ? finding !== null &&
        finding.severity === loaded.item.expected.severity &&
        evidenceMatches &&
        repairMatches
      : finding === null;
  return {
    loaded,
    finding,
    evidenceMatches,
    repairMatches,
    passed,
    incomplete: repair?.incomplete ?? false,
    durationMs: repair?.durationMs ?? 0
  };
}

function matchesExpectedFinding(loaded: LoadedReleaseCase, finding: Finding): boolean {
  const expectedType = actualFindingType(loaded.item.expected.findingType);
  if (!expectedType || finding.type !== expectedType || !caseCoversFinding(loaded, finding))
    return false;
  const expectedKind = expectedFindingKind(loaded.item.expected.findingType);
  return expectedKind === null || finding.explanation.toLocaleLowerCase().includes(expectedKind);
}

function matchesCaseSubject(loaded: LoadedReleaseCase, finding: Finding): boolean {
  if (loaded.item.family === "policy") return false;
  const expectedTypes = familyFindingTypes(loaded.item.family);
  if (!expectedTypes.includes(finding.type) || !caseCoversFinding(loaded, finding)) return false;
  const marker = negativeCaseMarker(loaded.item.id);
  return marker === null || finding.explanation.toLocaleLowerCase().includes(marker);
}

function caseCoversFinding(loaded: LoadedReleaseCase, finding: Finding): boolean {
  if (isSemanticFinding(finding)) {
    const expectedPaths = new Set(loaded.evidence.map((evidence) => evidence.notePath));
    return finding.evidence.every((evidence) => expectedPaths.has(evidence.notePath));
  }
  return finding.evidence.some((evidence) =>
    loaded.evidence.some((expected) => {
      if (expected.notePath !== evidence.notePath) return false;
      if (finding.type === "policy" || finding.type === "decision") return true;
      return expected.excerpt.includes(evidence.excerpt);
    })
  );
}

function citedEvidenceIds(loaded: LoadedReleaseCase, finding: Finding): string[] {
  return loaded.evidence.flatMap((expected) => {
    const cited = finding.evidence.some((evidence) => {
      if (evidence.notePath !== expected.notePath) return false;
      if (finding.type === "policy" || finding.type === "decision" || isSemanticFinding(finding))
        return true;
      return expected.excerpt.includes(evidence.excerpt);
    });
    return cited ? [expected.id] : [];
  });
}

function matchesRepair(
  loaded: LoadedReleaseCase,
  recommendation: ReferenceRepairRecommendation | undefined
): boolean {
  const expected = loaded.item.expected.repairEligibility;
  if (expected === "abstain") return recommendation === undefined;
  if (expected === "ineligible")
    return recommendation === undefined || recommendation.status === "abstained";
  if (!recommendation || recommendation.status === "abstained") return false;
  const target = loaded.item.candidateTargets.find(
    (candidate) => candidate.id === loaded.item.expected.candidateTargetId
  );
  return recommendation.targetPath === target?.notePath;
}

function actualFindingType(expected: string | null): FindingType | null {
  if (!expected) return null;
  if (expected.startsWith("task-")) return "task";
  if (expected.startsWith("decision-")) return "decision";
  if (expected.startsWith("policy-")) return "policy";
  return [
    "broken-reference",
    "invalid-reference",
    "entity-alias",
    "contradiction",
    "staleness",
    "schema"
  ].includes(expected)
    ? (expected as FindingType)
    : null;
}

function expectedFindingKind(expected: string | null): string | null {
  if (!expected) return null;
  if (expected.startsWith("task-")) return `is ${expected.slice("task-".length)}`;
  if (expected === "decision-missing-rationale") return "missing rationale";
  if (expected === "policy-missing-owner") return "project-owner-required";
  return null;
}

function negativeCaseMarker(id: string): string | null {
  if (id === "completed-task-not-overdue") return "is overdue";
  return null;
}

function familyFindingTypes(family: string): readonly FindingType[] {
  if (family === "reference") return ["broken-reference", "invalid-reference"];
  if (family === "task") return ["task"];
  if (family === "decision") return ["decision"];
  if (family === "contradiction") return ["contradiction"];
  if (family === "staleness") return ["staleness"];
  if (family === "entity") return ["entity-alias"];
  if (family === "schema") return ["schema"];
  return [];
}

function isDeterministicFinding(finding: Finding): boolean {
  return (
    finding.confidence === 1 &&
    ["broken-reference", "invalid-reference", "task", "schema", "decision", "policy"].includes(
      finding.type
    )
  );
}

function isSemanticFinding(finding: Finding): boolean {
  return !isDeterministicFinding(finding);
}

function instrumentProvider(source: ModelProvider): InstrumentedProvider {
  const invocations: InstrumentedProvider["invocations"] = [];
  return {
    invocations,
    provider: {
      config: source.config,
      capabilities: source.capabilities,
      async generate(request: LocalGenerationRequest): Promise<LocalGeneration> {
        const startedAt = performance.now();
        try {
          const result = await source.generate(request);
          invocations.push({
            durationMs: Math.max(result.latencyMs, Math.round(performance.now() - startedAt)),
            succeeded: true
          });
          return result;
        } catch (error) {
          invocations.push({
            durationMs: Math.round(performance.now() - startedAt),
            succeeded: false
          });
          throw error;
        }
      }
    }
  };
}

function buildIncompleteReport(
  input: {
    corpus: ReleaseCorpus;
    cases: readonly LoadedReleaseCase[];
    provider: ModelProvider;
    corpusFingerprint: string;
    now?: () => Date;
  },
  instrumented: InstrumentedProvider,
  scanDurationMs: number,
  errorCode: string | null
): ReleaseProviderReport {
  const metrics: ReleaseProviderReport["metrics"] = {
    precision: 0,
    recall: 0,
    f1: 0,
    evidenceValidity: 0,
    unsupportedFindingRate: 0,
    safeRepairValidity: 0,
    medianLatencyMs: percentile(
      instrumented.invocations.map((item) => item.durationMs),
      0.5
    ),
    p95LatencyMs: percentile(
      instrumented.invocations.map((item) => item.durationMs),
      0.95
    ),
    retries: 0,
    incompleteCases: input.cases.length,
    incompleteScans: 1,
    unsafeRemediations: 0
  };
  return createReport(input, {
    status: "incomplete",
    metrics,
    execution: {
      scanDurationMs,
      modelInvocations: instrumented.invocations.length,
      deterministicFindingCount: 0,
      semanticFindingCount: 0,
      repairRecommendations: 0
    },
    cases: input.cases.map((loaded) => ({
      id: loaded.item.id,
      outcome: "incomplete",
      durationMs: scanDurationMs,
      retries: 0,
      errorCode: safeErrorCode(errorCode)
    }))
  });
}

function createReport(
  input: {
    corpus: ReleaseCorpus;
    provider: ModelProvider;
    corpusFingerprint: string;
    now?: () => Date;
  },
  result: Pick<ReleaseProviderReport, "status" | "metrics" | "execution" | "cases">
): ReleaseProviderReport {
  const createdAt = (input.now ?? (() => new Date()))().toISOString();
  return {
    schemaVersion: 1,
    reportId: `northstar-${input.provider.config.kind}-${createHash("sha256")
      .update(`${input.corpus.id}:${createdAt}:${input.provider.config.model}`)
      .digest("hex")
      .slice(0, 12)}`,
    createdAt,
    corpusId: input.corpus.id,
    corpusFingerprint: input.corpusFingerprint,
    provider: input.provider.config.kind as "ollama" | "openai",
    model: input.provider.config.model,
    thresholds: THRESHOLDS,
    ...result
  };
}

function safeErrorCode(value: string | null): string {
  if (!value) return "provider-unavailable";
  return /^[a-z0-9-]{1,128}$/i.test(value) ? value : "provider-unavailable";
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]!;
}

function meetsThresholds(metrics: ReleaseProviderReport["metrics"]): boolean {
  return (
    metrics.precision >= THRESHOLDS.precision &&
    metrics.recall >= THRESHOLDS.recall &&
    metrics.f1 >= THRESHOLDS.f1 &&
    metrics.evidenceValidity >= THRESHOLDS.evidenceValidity &&
    metrics.unsupportedFindingRate <= THRESHOLDS.unsupportedFindingRate &&
    metrics.safeRepairValidity >= THRESHOLDS.safeRepairValidity &&
    metrics.incompleteScans <= THRESHOLDS.incompleteScans &&
    metrics.unsafeRemediations <= THRESHOLDS.unsafeRemediations
  );
}
