export const FEEDBACK_VERDICTS = ["false-positive", "useful", "needs-review"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

export const DISMISSAL_REASONS = [
  "false-positive",
  "expected-exception",
  "duplicate-report",
  "revisit-later"
] as const;
export type DismissalReason = (typeof DISMISSAL_REASONS)[number];

export function dismissalReasonLabel(reason: DismissalReason): string {
  switch (reason) {
    case "false-positive":
      return "False positive";
    case "expected-exception":
      return "Expected exception";
    case "duplicate-report":
      return "Duplicate report";
    case "revisit-later":
      return "Revisit later";
  }
}

export function dismissalReasonVerdict(reason: DismissalReason): FeedbackVerdict {
  return reason === "false-positive" ? "false-positive" : "needs-review";
}

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
