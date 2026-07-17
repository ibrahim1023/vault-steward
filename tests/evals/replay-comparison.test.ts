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
    {
      id: "case-1",
      outcome: "passed",
      durationMs: 10,
      errorCode: null,
      findings: [
        {
          findingKey: "broken-reference",
          evidence: { notePath: "Home.md", locator: "line:1" },
          severity: "medium",
          validation: {
            supported: true,
            schemaValid: true,
            routeValid: true,
            terminated: true
          }
        },
        {
          findingKey: "policy",
          evidence: { notePath: "Policy.md", locator: "line:2" },
          severity: "low",
          validation: {
            supported: true,
            schemaValid: true,
            routeValid: true,
            terminated: true
          }
        }
      ]
    },
    {
      id: "case-2",
      outcome: "failed",
      durationMs: 30,
      errorCode: "finding-mismatch",
      findings: [
        {
          findingKey: "schema",
          evidence: { notePath: "Schema.md", locator: "line:4" },
          severity: "high",
          validation: {
            supported: true,
            schemaValid: true,
            routeValid: true,
            terminated: true
          }
        }
      ]
    },
    {
      id: "case-4",
      outcome: "failed",
      durationMs: 25,
      errorCode: "evaluation-failed",
      findings: [
        {
          findingKey: "decision",
          evidence: { notePath: "Decision.md", locator: "line:8" },
          severity: "medium",
          validation: {
            supported: true,
            schemaValid: true,
            routeValid: true,
            terminated: true
          }
        }
      ]
    }
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
        {
          id: "case-1",
          outcome: "failed",
          durationMs: 12,
          errorCode: "finding-mismatch",
          findings: [
            {
              findingKey: "broken-reference",
              evidence: { notePath: "Home.md", locator: "line:3" },
              severity: "high",
              validation: {
                supported: true,
                schemaValid: true,
                routeValid: true,
                terminated: true
              }
            },
            {
              findingKey: "policy",
              evidence: { notePath: "Policy.md", locator: "line:2" },
              severity: "low",
              validation: {
                supported: false,
                schemaValid: true,
                routeValid: false,
                terminated: true
              }
            }
          ]
        },
        {
          id: "case-3",
          outcome: "incomplete",
          durationMs: 18,
          errorCode: "evaluation-failed",
          findings: [
            {
              findingKey: "task",
              evidence: { notePath: "Tasks.md", locator: "line:7" },
              severity: "low",
              validation: {
                supported: false,
                schemaValid: true,
                routeValid: true,
                terminated: true
              }
            }
          ]
        },
        {
          id: "case-4",
          outcome: "failed",
          durationMs: 25,
          errorCode: null,
          findings: [
            {
              findingKey: "decision",
              evidence: { notePath: "Decision.md", locator: "line:8" },
              severity: "medium",
              validation: {
                supported: true,
                schemaValid: true,
                routeValid: true,
                terminated: true
              }
            }
          ]
        }
      ],
      metrics: {
        ...baseRecord.metrics,
        precision: 0.5,
        recall: 0.75,
        falseNegatives: 1,
        evidenceSourceAccuracy: null
      },
      runtime: { totalDurationMs: 60, peakMemoryBytes: 256, inputTokens: null, outputTokens: 17 }
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
      removed: ["evaluation-failed", "finding-mismatch"],
      changed: [
        { id: "case-1", baseline: null, candidate: "finding-mismatch" },
        { id: "case-4", baseline: "evaluation-failed", candidate: null }
      ]
    });
    expect(comparison.findingDiff).toEqual({
      added: [{ caseId: "case-3", findingKey: "task" }],
      removed: [{ caseId: "case-2", findingKey: "schema" }],
      evidenceChanges: [
        {
          caseId: "case-1",
          findingKey: "broken-reference",
          baseline: { notePath: "Home.md", locator: "line:1" },
          candidate: { notePath: "Home.md", locator: "line:3" }
        }
      ],
      severityChanges: [
        {
          caseId: "case-1",
          findingKey: "broken-reference",
          baseline: "medium",
          candidate: "high"
        }
      ],
      validationChanges: [
        {
          caseId: "case-1",
          findingKey: "policy",
          baseline: {
            supported: true,
            schemaValid: true,
            routeValid: true,
            terminated: true
          },
          candidate: {
            supported: false,
            schemaValid: true,
            routeValid: false,
            terminated: true
          }
        }
      ]
    });
    expect(comparison.metricDiff).toMatchObject({
      precision: { baseline: 1, candidate: 0.5, delta: -0.5 },
      recall: { baseline: 1, candidate: 0.75, delta: -0.25 },
      falseNegatives: { baseline: 0, candidate: 1, delta: 1 },
      evidenceSourceAccuracy: { baseline: 1, candidate: null, delta: null }
    });
    expect(comparison.runtimeDiff).toEqual({
      totalDurationMs: 20,
      peakMemoryBytes: 128,
      inputTokens: { baseline: 11, candidate: null, delta: null },
      outputTokens: { baseline: 13, candidate: 17, delta: 4 }
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
