import type { ReviewerFeedback } from "./review.js";

export function summarizeReviewerFeedback(
  records: readonly (ReviewerFeedback & { policyId?: string })[]
): { counts: Record<string, number>; policySuggestions: string[] } {
  const counts = records.reduce<Record<string, number>>((result, record) => {
    result[record.verdict] = (result[record.verdict] ?? 0) + 1;
    return result;
  }, {});
  const falsePositives = new Map<string, number>();
  for (const record of records) {
    if (record.verdict === "false-positive" && record.policyId) {
      falsePositives.set(record.policyId, (falsePositives.get(record.policyId) ?? 0) + 1);
    }
  }
  return {
    counts,
    policySuggestions: [...falsePositives]
      .filter(([, count]) => count >= 3)
      .map(([policyId]) => `Review policy ${policyId} after repeated false-positive feedback.`)
  };
}
