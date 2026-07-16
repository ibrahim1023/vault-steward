import { describe, expect, it } from "vitest";

import { summarizeHumanReview } from "../../evals/human-review.js";

describe("human review agreement", () => {
  it("reports agreement only for independently reviewed samples", () => {
    expect(
      summarizeHumanReview([
        { caseId: "a", reviewerId: "one", label: "correct" },
        { caseId: "a", reviewerId: "two", label: "correct" },
        { caseId: "b", reviewerId: "one", label: "uncertain" }
      ])
    ).toEqual({
      sampledCaseCount: 2,
      independentlyReviewedCaseCount: 1,
      agreementRate: 1,
      unresolvedCaseCount: 1
    });
  });
});
