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
        }
      ]
    });
    expect(first.runtime.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(first.runtime.peakMemoryBytes).toBeGreaterThanOrEqual(0);
    expect(first.metrics.precision).toBe(1);
    expect(JSON.stringify(first)).not.toMatch(/\[\[Missing\]\]|\/Users\/|note body|raw output/i);
  });

  it("derives the same replay id for equivalent configurations regardless of property insertion order", async () => {
    const [referenceCase] = await loadEvaluationCases(root, "evals/manifests/ci-regression.json");
    const manifestHash = createHash("sha256")
      .update(await readFile(resolve(root, "evals/manifests/ci-regression.json")))
      .digest("hex");
    const orderedConfiguration = {
      model: "deterministic-fixture",
      prompt: "none",
      threshold: "fixture-threshold-v1",
      retrieval: "fixture-retrieval-v1",
      policy: "fixture-policy-v1",
      agent: "deterministic-runner"
    } as const;
    const reorderedConfiguration = {
      agent: "deterministic-runner",
      policy: "fixture-policy-v1",
      retrieval: "fixture-retrieval-v1",
      threshold: "fixture-threshold-v1",
      prompt: "none",
      model: "deterministic-fixture"
    } as const;

    const first = await replayFixtureEvaluation(root, [referenceCase as EvaluationCase], {
      sourceReportId: "report-ci-regression",
      fixtureManifestHash: manifestHash,
      configuration: orderedConfiguration
    });
    const second = await replayFixtureEvaluation(root, [referenceCase as EvaluationCase], {
      sourceReportId: "report-ci-regression",
      fixtureManifestHash: manifestHash,
      configuration: reorderedConfiguration
    });

    expect(first.replayId).toBe(second.replayId);
  });

  it("tracks the highest sampled heap usage across the full replay", async () => {
    const [referenceCase] = await loadEvaluationCases(root, "evals/manifests/ci-regression.json");
    const manifestHash = createHash("sha256")
      .update(await readFile(resolve(root, "evals/manifests/ci-regression.json")))
      .digest("hex");
    const samples = [101, 99, 250, 180, 340, 220, 305];
    let index = 0;

    const record = await replayFixtureEvaluation(root, [referenceCase as EvaluationCase], {
      sourceReportId: "report-ci-regression",
      fixtureManifestHash: manifestHash,
      configuration: fixtureConfiguration,
      memoryUsage: () => {
        const sample = index < samples.length ? samples[index]! : samples[samples.length - 1]!;
        index += 1;
        return sample;
      }
    });

    expect(record.runtime.peakMemoryBytes).toBe(250);
  });
});
