import { describe, expect, it } from "vitest";

import { summarizeReviewerFeedback } from "../../src/feedback/report.js";

describe("reviewer feedback reports", () => {
  it("suggests policy review only after repeated local false positives", () => {
    expect(
      summarizeReviewerFeedback(
        [1, 2, 3].map((index) => ({
          findingId: `finding-${index}`,
          verdict: "false-positive" as const,
          createdAt: "2026-07-16",
          policyId: "governance"
        }))
      )
    ).toEqual({
      counts: { "false-positive": 3 },
      policySuggestions: ["Review policy governance after repeated false-positive feedback."]
    });
  });
});
