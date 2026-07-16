export type HumanReviewLabel = {
  caseId: string;
  reviewerId: string;
  label: "correct" | "incorrect" | "uncertain";
};

export type HumanReviewAgreement = {
  sampledCaseCount: number;
  independentlyReviewedCaseCount: number;
  agreementRate: number | null;
  unresolvedCaseCount: number;
};

export function summarizeHumanReview(labels: readonly HumanReviewLabel[]): HumanReviewAgreement {
  const byCase = new Map<string, HumanReviewLabel[]>();
  for (const label of labels) {
    const group = byCase.get(label.caseId) ?? [];
    group.push(label);
    byCase.set(label.caseId, group);
  }
  let independentlyReviewedCaseCount = 0;
  let agreed = 0;
  let unresolvedCaseCount = 0;
  for (const group of byCase.values()) {
    const uniqueReviewers = new Set(group.map((label) => label.reviewerId));
    const labelsForCase = new Set(group.map((label) => label.label));
    if (group.some((label) => label.label === "uncertain")) unresolvedCaseCount += 1;
    if (uniqueReviewers.size >= 2) {
      independentlyReviewedCaseCount += 1;
      if (labelsForCase.size === 1) agreed += 1;
    }
  }
  return {
    sampledCaseCount: byCase.size,
    independentlyReviewedCaseCount,
    agreementRate:
      independentlyReviewedCaseCount === 0 ? null : agreed / independentlyReviewedCaseCount,
    unresolvedCaseCount
  };
}
