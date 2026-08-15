import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FindingFeedback } from "../../src/ui/FindingFeedback.js";

const finding = {
  schemaVersion: 1 as const,
  id: "finding",
  scanId: "scan",
  type: "policy" as const,
  severity: "low" as const,
  evidence: [],
  affectedNoteIds: [],
  explanation: "Issue",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("FindingFeedback", () => {
  afterEach(cleanup);

  it("stores an explicit local reviewer verdict and bounded label", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<FindingFeedback finding={finding} submit={submit} />);
    fireEvent.change(screen.getByLabelText("Feedback label"), {
      target: { value: "Expected exception" }
    });
    fireEvent.click(screen.getByRole("button", { name: "False positive" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(finding, "false-positive", "Expected exception")
    );
    expect(screen.getByRole("status")).toHaveTextContent("Feedback recorded locally.");
  });
});
