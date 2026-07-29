import { describe, expect, it } from "vitest";

import type { EvaluationReport } from "../../evals/contracts.js";
import { buildReleaseQualityReport } from "../../evals/release/quality-report.js";

const evaluation: EvaluationReport = {
  schemaVersion: 1,
  reportId: "report-1",
  createdAt: "2026-07-29T00:00:00.000Z",
  selection: { suite: "fixture", caseIds: ["case-1"], splits: ["ci-regression"] },
  provenance: {
    pluginVersion: "0.1.0",
    parserVersion: "scanner-v1",
    graderVersion: "grader-v1",
    promptVersions: ["none"],
    policyVersions: ["policy-v1"],
    schemaVersions: ["finding-v1"],
    modelProfile: "fixture",
    fixtureManifestHash: "a".repeat(64),
    configurationFingerprint: "b".repeat(64),
    hardware: { platform: "darwin", architecture: "arm64", memoryBytes: 1, runtime: "node" }
  },
  metrics: { precision: 1, recall: 1, f1: 1, falsePositives: 0, falseNegatives: 0 },
  cases: [{ id: "case-1", outcome: "passed", durationMs: 1, errorCode: null }]
};

describe("release quality report", () => {
  it("fails closed until both provider evidence and manual acceptance are present", () => {
    const report = buildReleaseQualityReport({
      generatedAt: "2026-07-29T00:00:00.000Z",
      evaluation,
      providerReports: [],
      manualAcceptance: false
    });
    expect(report).toMatchObject({
      decision: "no-go",
      privacy: { localByDefault: true, automaticPublishing: false, rawVaultContentIncluded: false }
    });
    expect(report.gates).toContainEqual({ name: "openai-provider", status: "pending" });
    expect(JSON.stringify(report)).not.toMatch(/note body|\/Users\//i);
  });
});
