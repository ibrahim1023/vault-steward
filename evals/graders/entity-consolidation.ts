export type EntityCanonicalEvaluationCase = {
  id: string;
  expected: "select" | "abstain";
  expectedCandidateId?: string;
  allowedCandidateIds: readonly string[];
  evidenceIds: readonly string[];
  safeRepair: "applicable" | "not-applicable";
};

export type EntityCanonicalEvaluationResult = {
  id: string;
  candidateId: string | null;
  citedEvidenceIds: readonly string[];
  schemaValid: boolean;
  safeRepairPrepared: boolean;
};

export function gradeEntityCanonicalSelections(
  cases: readonly EntityCanonicalEvaluationCase[],
  results: readonly EntityCanonicalEvaluationResult[]
) {
  const byId = new Map(results.map((result) => [result.id, result]));
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let correctAbstentions = 0;
  let incorrectCanonical = 0;
  let validEvidence = 0;
  let validRepair = 0;
  for (const testCase of cases) {
    const result = byId.get(testCase.id);
    if (!result) {
      if (testCase.expected === "select") falseNegative++;
      continue;
    }
    const selectionIsKnown =
      result.candidateId === null || testCase.allowedCandidateIds.includes(result.candidateId);
    const evidenceIsValid = result.citedEvidenceIds.every((id) =>
      testCase.evidenceIds.includes(id)
    );
    if (selectionIsKnown && evidenceIsValid && result.schemaValid) validEvidence++;
    if (testCase.expected === "abstain" && result.candidateId === null) correctAbstentions++;
    if (testCase.expected === "select") {
      if (result.candidateId === testCase.expectedCandidateId) truePositive++;
      else {
        falseNegative++;
        if (result.candidateId !== null) incorrectCanonical++;
      }
    } else if (result.candidateId !== null) {
      falsePositive++;
      incorrectCanonical++;
    }
    if (result.safeRepairPrepared === (testCase.safeRepair === "applicable")) validRepair++;
  }
  const precision = ratio(truePositive, truePositive + falsePositive + incorrectCanonical);
  const recall = ratio(truePositive, truePositive + falseNegative);
  return {
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    abstentionQuality: ratio(
      correctAbstentions,
      cases.filter((item) => item.expected === "abstain").length
    ),
    evidenceValidity: ratio(validEvidence, cases.length),
    incorrectCanonicalRate: ratio(incorrectCanonical, results.length),
    safeRepairValidity: ratio(validRepair, cases.length)
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
