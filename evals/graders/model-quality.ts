import type { ModelAssistedCase } from "./model-assisted.js";

export type ModelQualityResult = {
  id: string;
  predicted: "candidate" | "reject";
  citedEvidence: string[];
  schemaValid: boolean;
  severityMatches: boolean;
};

export function gradeModelQuality(
  cases: readonly ModelAssistedCase[],
  results: readonly ModelQualityResult[]
) {
  const byId = new Map(results.map((result) => [result.id, result]));
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let validCitations = 0;
  let validSchemas = 0;
  let severityMatches = 0;
  for (const testCase of cases) {
    const result = byId.get(testCase.id);
    if (!result) {
      if (testCase.expected === "candidate") falseNegative++;
      continue;
    }
    if (result.schemaValid) validSchemas++;
    if (result.severityMatches) severityMatches++;
    if (
      result.citedEvidence.length > 0 &&
      result.citedEvidence.every((item) => testCase.evidence.includes(item))
    )
      validCitations++;
    if (result.predicted === "candidate" && testCase.expected === "candidate") truePositive++;
    if (result.predicted === "candidate" && testCase.expected === "reject") falsePositive++;
    if (result.predicted === "reject" && testCase.expected === "candidate") falseNegative++;
  }
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  return {
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    falsePositives: falsePositive,
    falseNegatives: falseNegative,
    citationValidity: ratio(validCitations, cases.length),
    schemaValidity: ratio(validSchemas, cases.length),
    severityAgreement: ratio(severityMatches, cases.length),
    unsupportedClaimRate: ratio(
      results.filter((result) => !result.citedEvidence.length).length,
      results.length
    )
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
