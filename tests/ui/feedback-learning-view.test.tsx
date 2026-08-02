import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeedbackLearningView } from "../../src/ui/FeedbackLearningView.js";

describe("FeedbackLearningView", () => {
  it("requires repeated local false-positive feedback before offering suppression", () => {
    const suppressPattern = vi.fn(async () => undefined);
    render(
      <FeedbackLearningView
        records={[1, 2, 3].map((index) => ({
          id: `feedback-${index}`,
          findingId: `finding-${index}`,
          proposalId: null,
          verdict: "false-positive" as const,
          label: "expected-exception",
          patternKey: "task:Work/Plan.md",
          createdAt: "2026-08-02T00:00:00.000Z"
        }))}
        suppressedPatterns={[]}
        suppressPattern={suppressPattern}
      />
    );

    fireEvent.click(screen.getByText("Local review feedback"));
    expect(screen.getByText("3 local false-positive reports")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suppress from primary review" }));
    expect(suppressPattern).toHaveBeenCalledWith("task:Work/Plan.md");
  });
});
