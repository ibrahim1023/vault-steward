export type ModelAssistedCase = {
  id: string;
  schemaVersion: number;
  split: "development" | "ci-regression" | "held-out" | "adversarial" | "human-review";
  agent: "entity" | "contradiction" | "staleness" | "decision";
  promptVersion: string;
  model: string;
  modelSettings: { maxOutputTokens: number; temperature: number };
  graderVersion: string;
  evidence: string[];
  expected: "candidate" | "reject";
  rationale: string;
};

export function gradeModelAssistedDataset(cases: readonly ModelAssistedCase[]): {
  evidenceValidity: number;
  coverage: number;
} {
  const valid = cases.filter(
    (testCase) =>
      testCase.schemaVersion === 1 &&
      testCase.evidence.length > 0 &&
      testCase.evidence.every((evidence) => evidence.includes(":")) &&
      testCase.promptVersion.length > 0 &&
      testCase.model.length > 0 &&
      testCase.modelSettings.maxOutputTokens > 0 &&
      testCase.modelSettings.temperature === 0 &&
      testCase.graderVersion.length > 0 &&
      testCase.rationale.length > 0
  );
  const splits = new Set(cases.map((testCase) => testCase.split));
  return {
    evidenceValidity: cases.length === 0 ? 0 : valid.length / cases.length,
    coverage:
      ["development", "ci-regression", "held-out", "adversarial", "human-review"].filter((split) =>
        splits.has(split as ModelAssistedCase["split"])
      ).length / 5
  };
}
