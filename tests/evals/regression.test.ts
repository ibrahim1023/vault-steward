import { describe, expect, it } from "vitest";
import type { EvaluationReport } from "../../evals/contracts.js";
import { buildEvaluationRegressionReport, compareEvaluationReports } from "../../evals/regression.js";

const report = (precision: number): EvaluationReport => ({
  schemaVersion: 1 as const,
  reportId: "r",
  createdAt: "2026-07-16T00:00:00.000Z",
  selection: { suite: "reference", caseIds: ["c"], splits: ["ci-regression" as const] },
  provenance: {
    pluginVersion: "0.1.0",
    parserVersion: "p",
    graderVersion: "g",
    promptVersions: ["none"],
    policyVersions: ["policy-v1"],
    schemaVersions: ["finding-v1"],
    modelProfile: "fixture",
    fixtureManifestHash: "a".repeat(64),
    configurationFingerprint: "b".repeat(64),
    hardware: { platform: "darwin", architecture: "arm64", memoryBytes: 1, runtime: "node" }
  },
  metrics: {
    precision,
    recall: 1,
    f1: precision,
    falsePositives: 0,
    falseNegatives: 0,
    evidenceValidity: 1,
    schemaValidity: 1,
    routingCompliance: 1,
    terminationCompliance: 1,
    unsupportedClaimRate: 0
  },
  cases: [{ id: "c", outcome: "passed" as const, durationMs: 1, errorCode: null }]
});

describe("evaluation regression gates", () => {
  it("fails an unapproved precision regression", () =>
    expect(compareEvaluationReports(report(1), report(0.9))).toContain("precision dropped"));
  it("allows a documented threshold update", () =>
    expect(
      compareEvaluationReports(report(1), report(0.9), {
        author: "reviewer",
        date: "2026-07-16",
        affectedMetrics: ["precision", "f1"],
        reviewReason: "fixture correction"
      })
    ).toEqual([]));
  it("fails performance growth without a recorded rationale", () => {
    const baseline = report(1);
    baseline.metrics.p95LatencyMs = 100;
    const candidate = report(1);
    candidate.metrics.p95LatencyMs = 130;
    expect(compareEvaluationReports(baseline, candidate)).toContain("p95 latency increased");
  });
  it("emits a redacted local gate report for every comparison", () => {
    const summary = buildEvaluationRegressionReport({
      createdAt: "2026-07-29T00:00:00.000Z",
      baseline: report(1),
      candidate: report(0.9)
    });
    expect(summary).toMatchObject({ passed: false, failures: ["precision dropped", "f1 dropped"] });
    expect(JSON.stringify(summary)).not.toMatch(/note body|\/Users\//i);
  });
});
