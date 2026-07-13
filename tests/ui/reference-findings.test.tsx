import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import { ReferenceFindingsView } from "../../src/ui/ReferenceFindingsView.js";

describe("ReferenceFindingsView", () => {
  it("shows the severity, affected note, and evidence for a finding", () => {
    const finding: Finding = {
      schemaVersion: 1,
      id: "finding-1",
      scanId: "scan-1",
      type: "broken-reference",
      severity: "medium",
      evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["Home.md"],
      explanation: "Missing target note.",
      suggestedFixes: [],
      confidence: 1,
      status: "open"
    };

    render(<ReferenceFindingsView status="ready" findings={[finding]} />);

    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Home.md")).toBeInTheDocument();
    expect(screen.getByText("[[Missing]]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });
});
