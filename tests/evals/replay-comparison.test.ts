import { describe, expect, it } from "vitest";

import type { FixtureReplayRecord } from "../../evals/replay/contracts.js";
import { compareReplayRuns } from "../../evals/replay/compare.js";

const baseRecord: FixtureReplayRecord = {
  schemaVersion: 1,
  replayId: "replay-a",
  sourceReportId: "report-a",
  fixtureManifestHash: "a".repeat(64),
  configuration: {
    model: "model-a",
    prompt: "prompt-a",
    threshold: "threshold-a",
    retrieval: "retrieval-a",
    policy: "policy-a",
    agent: "agent-a"
  },
  caseResults: [
    { id: "case-1", outcome: "passed", durationMs: 10, errorCode: null },
    { id: "case-2", outcome: "failed", durationMs: 30, errorCode: "finding-mismatch" }
  ],
  metrics: {
    precision: 1,
    recall: 1,
    f1: 1,
    falsePositives: 0,
    falseNegatives: 0,
    evidenceSourceAccuracy: 1,
    sourceRangeAccuracy: 1,
    severityAgreement: 1,
    suggestedFixValidity: 1,
    unsupportedClaimRate: 0,
    schemaValidity: 1,
    routingCompliance: 1,
    terminationCompliance: 1
  },
  runtime: { totalDurationMs: 40, peakMemoryBytes: 128, inputTokens: 11, outputTokens: 13 }
};

describe("replay comparison", () => {
  it("accepts exactly one changed replay variable and reports redacted deltas", () => {
    const comparison = compareReplayRuns(baseRecord, {
      ...baseRecord,
      replayId: "replay-b",
      configuration: { ...baseRecord.configuration, model: "model-b" },
      caseResults: [
        { id: "case-1", outcome: "failed", durationMs: 12, errorCode: "finding-mismatch" },
        { id: "case-3", outcome: "incomplete", durationMs: 18, errorCode: "evaluation-failed" }
      ],
      metrics: {
        ...baseRecord.metrics,
        precision: 0.5,
        recall: 0.75,
        falseNegatives: 1
      },
      runtime: { totalDurationMs: 60, peakMemoryBytes: 256, inputTokens: 19, outputTokens: 17 }
    });

    expect(comparison).toMatchObject({
      accepted: true,
      changedVariable: "model"
    });
    if (!comparison.accepted) throw new Error("Expected accepted comparison.");
    expect(comparison.caseDiff).toEqual({
      added: ["case-3"],
      removed: ["case-2"],
      outcomeChanges: [{ id: "case-1", baseline: "passed", candidate: "failed" }],
      durationChanges: [{ id: "case-1", deltaMs: 2 }]
    });
    expect(comparison.failureDiff).toEqual({
      added: ["evaluation-failed"],
      removed: [],
      changed: [{ id: "case-1", baseline: null, candidate: "finding-mismatch" }]
    });
    expect(comparison.metricDiff).toMatchObject({
      precision: -0.5,
      recall: -0.25,
      falseNegatives: 1
    });
    expect(comparison.runtimeDiff).toEqual({
      totalDurationMs: 20,
      peakMemoryBytes: 128,
      inputTokens: 8,
      outputTokens: 4
    });
    expect(JSON.stringify(comparison)).not.toMatch(/\/Users\/|https?:\/\/|\[\[/);
  });

  it("rejects comparisons without exactly one changed replay variable", () => {
    expect(compareReplayRuns(baseRecord, baseRecord)).toMatchObject({
      accepted: false,
      reason: "no-configuration-change"
    });

    expect(
      compareReplayRuns(baseRecord, {
        ...baseRecord,
        configuration: {
          ...baseRecord.configuration,
          model: "model-b",
          prompt: "prompt-b"
        }
      })
    ).toMatchObject({
      accepted: false,
      reason: "multiple-configuration-changes"
    });
  });

  it("rejects comparisons when the fixture manifest changes", () => {
    expect(
      compareReplayRuns(baseRecord, {
        ...baseRecord,
        replayId: "replay-b",
        fixtureManifestHash: "b".repeat(64),
        configuration: { ...baseRecord.configuration, model: "model-b" }
      })
    ).toMatchObject({
      accepted: false,
      reason: "fixture-manifest-mismatch"
    });
  });
});
