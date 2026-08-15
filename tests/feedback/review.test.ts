import { describe, expect, it } from "vitest";

import { dismissalReasonVerdict, validateReviewerFeedback } from "../../src/feedback/review.js";

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

  it("counts only explicit false-positive dismissals toward local suppression", () => {
    expect(dismissalReasonVerdict("false-positive")).toBe("false-positive");
    expect(dismissalReasonVerdict("expected-exception")).toBe("needs-review");
    expect(dismissalReasonVerdict("duplicate-report")).toBe("needs-review");
    expect(dismissalReasonVerdict("revisit-later")).toBe("needs-review");
  });
});
