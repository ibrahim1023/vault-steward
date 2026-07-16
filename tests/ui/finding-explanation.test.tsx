import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FindingExplanation } from "../../src/ui/FindingExplanation.js";

const finding = {
  schemaVersion: 1 as const,
  id: "finding",
  scanId: "scan",
  type: "policy" as const,
  severity: "low" as const,
  evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "text" }],
  affectedNoteIds: ["Home.md"],
  explanation: "Policy issue",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("FindingExplanation", () => {
  afterEach(cleanup);

  it("requests an explanation only after an explicit action and clears it for a new finding", async () => {
    const explain = async () => ({ ok: true as const, text: "Cited evidence only.", latencyMs: 1 });
    const { rerender } = render(<FindingExplanation finding={finding} explain={explain} />);
    expect(screen.queryByText("Cited evidence only.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Explain cited evidence" }));
    await waitFor(() => expect(screen.getByText("Cited evidence only.")).toBeInTheDocument());
    rerender(<FindingExplanation finding={{ ...finding, id: "next" }} explain={explain} />);
    expect(screen.queryByText("Cited evidence only.")).toBeNull();
  });
});
