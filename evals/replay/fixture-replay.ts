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
};

export async function replayFixtureEvaluation(
  root: string,
  cases: readonly EvaluationCase[],
  replay: FixtureReplayConfiguration
): Promise<FixtureReplayRecord> {
  const startedAt = performance.now();
  const caseExecutions = await Promise.all(
    cases.map(async (evaluationCase) => {
      const caseStartedAt = performance.now();
      try {
        const actual = await evaluateFixtureCase(root, evaluationCase);
        const metrics = gradeExpectedFindings(expectedFindings(evaluationCase), actual);
        const matched =
          metrics.falsePositives === 0 &&
          metrics.falseNegatives === 0 &&
          metrics.precision === 1 &&
          metrics.recall === 1;
        return {
          metrics,
          caseResult: {
            id: evaluationCase.id,
            outcome: matched ? ("passed" as const) : ("failed" as const),
            durationMs: Math.round(performance.now() - caseStartedAt),
            errorCode: matched ? null : "finding-mismatch"
          }
        };
      } catch {
        return {
          metrics: emptyMetrics(),
          caseResult: {
            id: evaluationCase.id,
            outcome: "incomplete" as const,
            durationMs: Math.round(performance.now() - caseStartedAt),
            errorCode: "evaluation-failed"
          }
        };
      }
    })
  );
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
      peakMemoryBytes: process.memoryUsage().heapUsed,
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
      JSON.stringify({
        caseIds: cases.map((item) => item.id),
        fixtureManifestHash: replay.fixtureManifestHash,
        configuration: replay.configuration
      })
    )
    .digest("hex")
    .slice(0, 24);
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
