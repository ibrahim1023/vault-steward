import { describe, expect, it } from "vitest";

import { validateReviewerFeedback } from "../../src/feedback/review.js";

describe("reviewer feedback", () => {
  it("accepts bounded known verdicts only", () => {
    expect(validateReviewerFeedback({ findingId: "finding", verdict: "useful" })).toBeNull();
    expect(validateReviewerFeedback({ findingId: "finding", verdict: "other" as "useful" })).toBe(
      "Feedback verdict is invalid."
    );
    expect(validateReviewerFeedback({ findingId: "", verdict: "useful" })).toBe(
      "A finding is required."
    );
  });
});
