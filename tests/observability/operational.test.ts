import { describe, expect, it } from "vitest";

import {
  calculatePercentile,
  evaluateOperationalBaseline,
  summarizeOperationalMetrics
} from "../../src/observability/operational.js";

const baseline = {
  schemaVersion: 1 as const,
  maxScanDurationMs: 1_000,
  maxParseErrors: 0,
  maxModelLatencyMs: 1_000,
  maxTokenUsage: 2_000,
  maxToolCalls: 4,
  maxRetryRate: 0.5,
  maxIncompleteRate: 0,
  maxFindingVolume: 100,
  maxStaleProposals: 0,
  maxApplyFailureRate: 0
};

describe("operational baselines", () => {
  it("reports an observed percentile only when samples exist", () => {
    expect(calculatePercentile([], 0.95)).toBeNull();
    expect(calculatePercentile([10, 20, 30], 0.5)).toBe(20);
    expect(calculatePercentile([10, 20, 30], 0.95)).toBe(30);
  });
  it("summarizes redacted operational measurements and accepts the baseline", () => {
    const metrics = summarizeOperationalMetrics([
      {
        scanDurationMs: 20,
        parseErrors: 0,
        modelLatencyMs: 10,
        tokenUsage: 100,
        toolCalls: 1,
        retries: 0,
        incomplete: false,
        findingVolume: 1,
        staleProposals: 0,
        applyAttempts: 1,
        applyFailures: 0
      }
    ]);
    expect(metrics).toEqual({
      scanDurationMs: 20,
      parseErrors: 0,
      modelLatencyMs: 10,
      tokenUsage: 100,
      toolCalls: 1,
      retryRate: 0,
      incompleteRate: 0,
      findingVolume: 1,
      staleProposals: 0,
      applyFailureRate: 0
    });
    expect(evaluateOperationalBaseline(baseline, metrics)).toEqual([]);
  });

  it("fails metrics that exceed an MVP gate", () => {
    expect(
      evaluateOperationalBaseline(baseline, {
        scanDurationMs: 2_000,
        parseErrors: 1,
        modelLatencyMs: 2_000,
        tokenUsage: 3_000,
        toolCalls: 5,
        retryRate: 1,
        incompleteRate: 1,
        findingVolume: 101,
        staleProposals: 1,
        applyFailureRate: 1
      })
    ).toHaveLength(10);
  });
});
