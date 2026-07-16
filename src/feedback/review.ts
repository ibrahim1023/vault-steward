export const FEEDBACK_VERDICTS = ["false-positive", "useful", "needs-review"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];
export type ReviewerFeedback = {
  findingId: string;
  proposalId?: string;
  verdict: FeedbackVerdict;
  label?: string;
  createdAt: string;
};

export function validateReviewerFeedback(
  value: Omit<ReviewerFeedback, "createdAt">
): string | null {
  if (!value.findingId.trim()) return "A finding is required.";
  if (!FEEDBACK_VERDICTS.includes(value.verdict)) return "Feedback verdict is invalid.";
  if (value.label !== undefined && value.label.length > 120) return "Feedback label is too long.";
  return null;
}
