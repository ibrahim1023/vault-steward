import { describe, expect, it } from "vitest";
import { compareEvaluationReports } from "../../evals/regression.js";

const report = (precision: number) => ({
  schemaVersion: 1 as const,
  reportId: "r",
  createdAt: "2026-07-16T00:00:00.000Z",
  selection: { suite: "reference", caseIds: ["c"], splits: ["ci-regression" as const] },
  provenance: {
    pluginVersion: "0.1.0",
    parserVersion: "p",
    graderVersion: "g",
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
});
