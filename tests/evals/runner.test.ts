import { describe, expect, it } from "vitest";
import { parseEvaluationSelection, selectEvaluationCases } from "../../evals/runner.js";

const cases = [
  { schemaVersion: 1, id: "dev", family: "reference", split: "development", fixturePath: "evals/cases/reference/dev/vault", expected: [], contamination: { developmentVisible: true, reason: "dev" } },
  { schemaVersion: 1, id: "held", family: "reference", split: "held-out", fixturePath: "evals/cases/reference/held/vault", expected: [], contamination: { developmentVisible: false, reason: "held" } }
] as const;

describe("evaluation selection", () => {
  it("defaults to development and CI-regression without selecting held-out cases", () => {
    const selection = parseEvaluationSelection([]);
    expect(selection.splits).toEqual(["development", "ci-regression"]);
    expect(selectEvaluationCases(cases as never, selection).map((item) => item.id)).toEqual(["dev"]);
  });
  it("requires known cases and explicit held-out selection", () => {
    expect(() => selectEvaluationCases(cases as never, { splits: ["development"], caseIds: ["unknown"] })).toThrow("Unknown evaluation case");
    expect(selectEvaluationCases(cases as never, parseEvaluationSelection(["--split", "held-out"])).map((item) => item.id)).toEqual(["held"]);
  });
});
