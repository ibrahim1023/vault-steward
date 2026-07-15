import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProposalReviewPanel } from "../../src/ui/ProposalReviewPanel.js";

const proposal = {
  schemaVersion: 1 as const,
  id: "proposal-1",
  findingId: "finding",
  scanId: "scan",
  explanation: "Repair",
  operations: [
    {
      kind: "replace-range" as const,
      path: "Home.md",
      sourceRevision: "r",
      start: 0,
      end: 11,
      expected: "[[Missing]]",
      replacement: "[[Target]]"
    }
  ]
};

describe("ProposalReviewPanel", () => {
  it("requires an explicit approval and confirmation before apply", async () => {
    const onAction = vi.fn();
    const onApply = vi.fn(async () => ({ ok: true as const }));
    const { rerender } = render(
      <ProposalReviewPanel
        proposal={proposal}
        sources={{ "Home.md": "[[Missing]]" }}
        status="pending"
        onAction={onAction}
        onApply={onApply}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve proposal" }));
    expect(onAction).toHaveBeenCalledWith("proposal-1", "approved");
    expect(onApply).not.toHaveBeenCalled();
    rerender(
      <ProposalReviewPanel
        proposal={proposal}
        sources={{ "Home.md": "[[Missing]]" }}
        status="approved"
        onAction={onAction}
        onApply={onApply}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply approved change" }));
    expect(
      screen.getByRole("alertdialog", { name: "Apply this approved change?" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm apply" }));
    await expect(onApply).toHaveBeenCalledWith("proposal-1");
  });
});
