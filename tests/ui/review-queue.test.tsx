import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffPreview } from "../../src/ui/DiffPreview.js";
import { ReviewQueueView, filterReviewFindings } from "../../src/ui/ReviewQueueView.js";

const finding = {
  schemaVersion: 1 as const,
  id: "f",
  scanId: "s",
  type: "broken-reference" as const,
  severity: "high" as const,
  evidence: [{ notePath: "A.md", locator: "line:1", excerpt: "x" }],
  affectedNoteIds: ["A.md"],
  explanation: "Broken",
  suggestedFixes: [],
  confidence: 0.9,
  status: "open" as const
};
const proposal = {
  schemaVersion: 1 as const,
  id: "p",
  findingId: "f",
  scanId: "s",
  explanation: "Repair",
  operations: [
    {
      kind: "replace-range" as const,
      path: "A.md",
      sourceRevision: "r",
      start: 4,
      end: 5,
      expected: "x",
      replacement: "y"
    },
    {
      kind: "replace-range" as const,
      path: "B.md",
      sourceRevision: "r",
      start: 0,
      end: 1,
      expected: "a",
      replacement: "b"
    }
  ]
};

describe("review UI", () => {
  it("filters, groups duplicates, and renders empty/error states", () => {
    expect(filterReviewFindings([finding], { minimumConfidence: 1 })).toEqual([]);
    render(
      <ReviewQueueView status="ready" findings={[finding, { ...finding, id: "duplicate" }]} />
    );
    expect(screen.getByText("2 matching findings grouped")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Minimum confidence"), { target: { value: "1" } });
    expect(screen.getByText("No findings match the current filters.")).toBeInTheDocument();
  });
  it("renders multi-file diffs and a mismatch failure", () => {
    const { rerender } = render(
      <DiffPreview proposal={proposal} sources={{ "A.md": "See x", "B.md": "a" }} maxLength={10} />
    );
    expect(screen.getByText("B.md")).toBeInTheDocument();
    rerender(<DiffPreview proposal={proposal} sources={{ "A.md": "changed", "B.md": "a" }} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("keeps filters keyboard-native and diff evidence preformatted", () => {
    const { container } = render(<ReviewQueueView status="ready" findings={[finding]} />);
    const type = container.querySelector("select");
    if (!type) throw new Error("expected a review type filter");
    type.focus();
    expect(type).toHaveFocus();
    expect(container.querySelectorAll("select")).toHaveLength(4);

    const { container: diffContainer } = render(
      <DiffPreview proposal={proposal} sources={{ "A.md": "See x", "B.md": "a" }} />
    );
    expect(diffContainer.querySelectorAll("pre")).toHaveLength(4);
  });
  it("renders idle, scanning, error, stale, and dismissed review states", () => {
    const { rerender } = render(<ReviewQueueView status="idle" findings={[]} />);
    expect(screen.getByText("Ready to review findings.")).toBeInTheDocument();
    rerender(<ReviewQueueView status="scanning" findings={[]} />);
    expect(screen.getByText("Refreshing review queue...")).toBeInTheDocument();
    rerender(<ReviewQueueView status="error" findings={[]} errorMessage="Unavailable" />);
    expect(screen.getByText("Unavailable")).toHaveAttribute("role", "alert");
    rerender(
      <ReviewQueueView
        status="ready"
        findings={[
          { ...finding, status: "stale" },
          { ...finding, id: "dismissed", status: "dismissed" }
        ]}
      />
    );
    expect(screen.getByText("Status: stale")).toBeInTheDocument();
  });
});
