import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { loadEvaluationCases } from "../../evals/fixtures.js";

const root = resolve(import.meta.dirname, "../..");

describe("evaluation fixture loader", () => {
  it("loads validated case directories and selects a declared split", async () => {
    await expect(
      loadEvaluationCases(root, "evals/manifests/ci-regression.json", { splits: ["ci-regression"] })
    ).resolves.toMatchObject([{ id: "reference-missing-ci", family: "reference" }]);
  });
  it("rejects traversal-like manifests", async () => {
    await expect(loadEvaluationCases(root, "../outside.json")).rejects.toThrow(
      "Evaluation path is invalid."
    );
  });
  it("loads every supported finding family from canonical fixture directories", async () => {
    const cases = await loadEvaluationCases(root, "evals/manifests/all-families.json", {
      splits: ["development", "ci-regression", "adversarial", "human-review"]
    });
    expect(new Set(cases.map((item) => item.family))).toEqual(
      new Set([
        "reference",
        "entity",
        "contradiction",
        "staleness",
        "task",
        "schema",
        "policy",
        "decision"
      ])
    );
  });
});
