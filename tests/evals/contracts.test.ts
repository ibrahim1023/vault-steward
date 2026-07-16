import { describe, expect, it } from "vitest";

import { validateEvaluationCase, validateEvaluationReport } from "../../evals/contracts.js";

const validCase = {
  schemaVersion: 1,
  id: "reference-missing-dev",
  family: "reference",
  split: "development",
  fixturePath: "evals/cases/reference/reference-missing-dev/vault",
  expected: [
    {
      id: "missing-link",
      type: "broken-reference",
      notePath: "Home.md",
      locator: "line:1",
      severity: "medium",
      safeFix: "applicable"
    }
  ],
  contamination: { developmentVisible: true, reason: "baseline fixture" }
} as const;

describe("evaluation contracts", () => {
  it("accepts bounded cases and rejects unsafe fixture paths or split governance", () => {
    expect(validateEvaluationCase(validCase)).toBe(true);
    expect(validateEvaluationCase({ ...validCase, fixturePath: "../vault" })).toBe(false);
    expect(
      validateEvaluationCase({
        ...validCase,
        split: "held-out",
        contamination: { developmentVisible: true, reason: "incorrect" }
      })
    ).toBe(false);
  });

  it("rejects content-bearing report fields", () => {
    expect(
      validateEvaluationReport({
        schemaVersion: 1,
        reportId: "report-1",
        createdAt: "2026-07-16T00:00:00.000Z",
        selection: {
          suite: "reference",
          caseIds: ["reference-missing-dev"],
          splits: ["development"]
        },
        provenance: {
          pluginVersion: "0.1.0",
          parserVersion: "scanner-v1",
          graderVersion: "v1",
          fixtureManifestHash: "a".repeat(64),
          configurationFingerprint: "b".repeat(64),
          hardware: { platform: "darwin", architecture: "arm64", memoryBytes: 1, runtime: "node" }
        },
        metrics: { precision: 1, recall: 1, f1: 1, falsePositives: 0, falseNegatives: 0 },
        cases: [{ id: "reference-missing-dev", outcome: "passed", durationMs: 1, errorCode: null }]
      })
    ).toBe(true);
    expect(
      validateEvaluationReport({
        schemaVersion: 1,
        reportId: "report-1",
        createdAt: "2026-07-16T00:00:00.000Z",
        selection: {
          suite: "reference",
          caseIds: ["reference-missing-dev"],
          splits: ["development"]
        },
        provenance: {
          pluginVersion: "note body content",
          parserVersion: "scanner-v1",
          graderVersion: "v1",
          fixtureManifestHash: "a".repeat(64),
          configurationFingerprint: "b".repeat(64),
          hardware: { platform: "darwin", architecture: "arm64", memoryBytes: 1, runtime: "node" }
        },
        metrics: { precision: 1, recall: 1, f1: 1, falsePositives: 0, falseNegatives: 0 },
        cases: []
      })
    ).toBe(false);
  });
});
