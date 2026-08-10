import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateFixtureCase } from "../../evals/evaluate-case.js";
import { loadEvaluationCases } from "../../evals/fixtures.js";

const root = resolve(import.meta.dirname, "../..");

describe("fixture evaluation", () => {
  it("runs the reference checker against the fixture vault", async () => {
    const [evaluationCase] = await loadEvaluationCases(root, "evals/manifests/ci-regression.json");
    await expect(evaluateFixtureCase(root, evaluationCase!)).resolves.toMatchObject([
      { type: "broken-reference", notePath: "Home.md", locator: "line:1:column:1" }
    ]);
  });
});
