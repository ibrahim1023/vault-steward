import { describe, expect, it } from "vitest";

import { summarizeModelComparisons } from "../../evals/replay/model-comparison.js";

describe("local model comparison", () => {
  it("groups local replay samples without selecting a best model", () => {
    const report = summarizeModelComparisons([
      {
        agent: "entity",
        family: "entity",
        vaultScale: "small",
        model: "local-a",
        hardware: "arm64-16gb",
        retryCount: 1,
        comparisonAccepted: true,
        replay: {
          metrics: { precision: 1, recall: 0.8, f1: 0.89, evidenceSourceAccuracy: 1 },
          runtime: { totalDurationMs: 12, peakMemoryBytes: 100, inputTokens: 10, outputTokens: 5 },
          caseResults: [{ outcome: "passed" }, { outcome: "incomplete" }]
        }
      },
      {
        agent: "entity",
        family: "entity",
        vaultScale: "small",
        model: "local-b",
        hardware: "arm64-16gb",
        retryCount: 0,
        comparisonAccepted: true,
        replay: {
          metrics: { precision: 0.8, recall: 0.9, f1: 0.85, evidenceSourceAccuracy: 0.9 },
          runtime: { totalDurationMs: 9, peakMemoryBytes: 80, inputTokens: 8, outputTokens: 4 },
          caseResults: [{ outcome: "passed" }]
        }
      }
    ]);

    expect(report.comparisonOnly).toBe(true);
    expect(report.rows).toEqual([
      expect.objectContaining({
        agent: "entity",
        family: "entity",
        vaultScale: "small",
        model: "local-a",
        hardware: "arm64-16gb",
        precision: 1,
        recall: 0.8,
        f1: 0.89,
        evidenceValidity: 1,
        p50LatencyMs: 12,
        p95LatencyMs: 12,
        peakMemoryBytes: 100,
        retryCount: 1,
        incompleteRate: 0.5
      }),
      expect.objectContaining({ model: "local-b", p95LatencyMs: 9, incompleteRate: 0 })
    ]);
    expect(JSON.stringify(report)).not.toMatch(/best|recommended|\/Users\/|https?:\/\//i);
  });

  it("rejects a sample that did not pass controlled comparison", () => {
    expect(() =>
      summarizeModelComparisons([
        {
          agent: "entity",
          family: "entity",
          vaultScale: "small",
          model: "local-a",
          hardware: "arm64-16gb",
          retryCount: 0,
          comparisonAccepted: false,
          replay: {
            metrics: { precision: 1, recall: 1, f1: 1, evidenceSourceAccuracy: 1 },
            runtime: { totalDurationMs: 1, peakMemoryBytes: 1 },
            caseResults: []
          }
        }
      ])
    ).toThrow("accepted controlled comparisons");
  });
});
