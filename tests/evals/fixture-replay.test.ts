import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvaluationCase } from "../../evals/contracts.js";
import { loadEvaluationCases } from "../../evals/fixtures.js";
import { replayFixtureEvaluation } from "../../evals/replay/fixture-replay.js";

const root = resolve(import.meta.dirname, "../..");

const fixtureConfiguration = {
  model: "deterministic-fixture",
  prompt: "none",
  threshold: "fixture-threshold-v1",
  retrieval: "fixture-retrieval-v1",
  policy: "fixture-policy-v1",
  agent: "deterministic-runner"
} as const;

describe("fixture replay evaluation", () => {
  it("replays fixture cases with a stable id and redacted bounded record", async () => {
    const [referenceCase] = await loadEvaluationCases(root, "evals/manifests/ci-regression.json");
    const manifestHash = createHash("sha256")
      .update(await readFile(resolve(root, "evals/manifests/ci-regression.json")))
      .digest("hex");

    const first = await replayFixtureEvaluation(root, [referenceCase as EvaluationCase], {
      sourceReportId: "report-ci-regression",
      fixtureManifestHash: manifestHash,
      configuration: fixtureConfiguration
    });
    const second = await replayFixtureEvaluation(root, [referenceCase as EvaluationCase], {
      sourceReportId: "report-ci-regression",
      fixtureManifestHash: manifestHash,
      configuration: fixtureConfiguration
    });

    expect(first.replayId).toBe(second.replayId);
    expect(first.caseResults[0]).toMatchObject({
      id: "reference-missing-ci",
      outcome: "passed",
      errorCode: null
    });
    expect(first.runtime.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(first.runtime.peakMemoryBytes).toBeGreaterThanOrEqual(0);
    expect(first.metrics.precision).toBe(1);
    expect(JSON.stringify(first)).not.toMatch(/\[\[Missing\]\]|\/Users\//);
  });
});
