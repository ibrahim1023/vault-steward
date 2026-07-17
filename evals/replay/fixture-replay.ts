import { createHash } from "node:crypto";

import type { EvaluationCase, EvaluationReport } from "../contracts.js";
import { evaluateFixtureCase } from "../evaluate-case.js";
import { gradeExpectedFindings, type GradedFinding } from "../graders/metrics.js";
import {
  type FixtureReplayRecord,
  type ReplayVariable,
  validateFixtureReplayRecord
} from "./contracts.js";

export type FixtureReplayConfiguration = {
  sourceReportId: string;
  fixtureManifestHash: string;
  configuration: Record<ReplayVariable, string>;
  memoryUsage?: () => number;
};

export async function replayFixtureEvaluation(
  root: string,
  cases: readonly EvaluationCase[],
  replay: FixtureReplayConfiguration
): Promise<FixtureReplayRecord> {
  const startedAt = performance.now();
  let peakMemoryBytes = sampleMemoryUsage(replay);
  const caseExecutions = [];
  for (const evaluationCase of cases) {
    peakMemoryBytes = Math.max(peakMemoryBytes, sampleMemoryUsage(replay));
    const caseStartedAt = performance.now();
    try {
      const actual = await evaluateFixtureCase(root, evaluationCase);
      peakMemoryBytes = Math.max(peakMemoryBytes, sampleMemoryUsage(replay));
      const metrics = gradeExpectedFindings(expectedFindings(evaluationCase), actual);
      const matched =
        metrics.falsePositives === 0 &&
        metrics.falseNegatives === 0 &&
        metrics.precision === 1 &&
        metrics.recall === 1;
      caseExecutions.push({
        metrics,
        caseResult: {
          id: evaluationCase.id,
          outcome: matched ? ("passed" as const) : ("failed" as const),
          durationMs: Math.round(performance.now() - caseStartedAt),
          errorCode: matched ? null : "finding-mismatch"
        }
      });
    } catch {
      peakMemoryBytes = Math.max(peakMemoryBytes, sampleMemoryUsage(replay));
      caseExecutions.push({
        metrics: emptyMetrics(),
        caseResult: {
          id: evaluationCase.id,
          outcome: "incomplete" as const,
          durationMs: Math.round(performance.now() - caseStartedAt),
          errorCode: "evaluation-failed"
        }
      });
    }
  }
  peakMemoryBytes = Math.max(peakMemoryBytes, sampleMemoryUsage(replay));
  const record: FixtureReplayRecord = {
    schemaVersion: 1,
    replayId: replayIdFor(cases, replay),
    sourceReportId: replay.sourceReportId,
    fixtureManifestHash: replay.fixtureManifestHash,
    configuration: replay.configuration,
    caseResults: caseExecutions.map((item) => item.caseResult),
    metrics: averageMetrics(caseExecutions.map((item) => item.metrics)),
    runtime: {
      totalDurationMs: Math.round(performance.now() - startedAt),
      peakMemoryBytes,
      inputTokens: null,
      outputTokens: null
    }
  };
  if (!validateFixtureReplayRecord(record)) throw new Error("Generated fixture replay record is invalid.");
  return record;
}

function replayIdFor(
  cases: readonly EvaluationCase[],
  replay: FixtureReplayConfiguration
): string {
  return createHash("sha256")
    .update(
      stableStringify({
        caseIds: cases.map((item) => item.id),
        fixtureManifestHash: replay.fixtureManifestHash,
        configuration: replay.configuration
      })
    )
    .digest("hex")
    .slice(0, 24);
}

function sampleMemoryUsage(replay: FixtureReplayConfiguration): number {
  return replay.memoryUsage?.() ?? process.memoryUsage().heapUsed;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function expectedFindings(evaluationCase: EvaluationCase): GradedFinding[] {
  return evaluationCase.expected.map((finding) => ({
    ...finding,
    supported: true,
    schemaValid: true,
    routeValid: true,
    terminated: true
  }));
}

function emptyMetrics(): EvaluationReport["metrics"] {
  return {
    precision: null,
    recall: null,
    f1: null,
    falsePositives: 0,
    falseNegatives: 0,
    evidenceSourceAccuracy: null,
    sourceRangeAccuracy: null,
    severityAgreement: null,
    suggestedFixValidity: null,
    unsupportedClaimRate: null,
    schemaValidity: null,
    routingCompliance: null,
    terminationCompliance: null
  };
}

function averageMetrics(
  items: readonly EvaluationReport["metrics"][]
): EvaluationReport["metrics"] {
  const keys = Object.keys(items[0] ?? emptyMetrics());
  return Object.fromEntries(
    keys.map((key) => {
      const values = items
        .map((item) => item[key as keyof typeof item])
        .filter((value): value is number => typeof value === "number");
      return [
        key,
        values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
      ];
    })
  ) as EvaluationReport["metrics"];
}
