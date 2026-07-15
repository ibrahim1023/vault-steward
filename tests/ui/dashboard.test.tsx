import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countDashboardFindings,
  rankDashboardFindings,
  selectDashboardFinding,
  selectNextBestAction
} from "../../src/ui/dashboard.js";
import { NextBestAction } from "../../src/ui/NextBestAction.js";
import { PriorityFindings } from "../../src/ui/PriorityFindings.js";
import { VaultHealthSummary } from "../../src/ui/VaultHealthSummary.js";

const finding = {
  schemaVersion: 1 as const,
  id: "medium",
  scanId: "scan",
  type: "broken-reference" as const,
  severity: "medium" as const,
  evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
  affectedNoteIds: ["Home.md"],
  explanation: "Missing target",
  suggestedFixes: [],
  confidence: 0.8,
  status: "open" as const
};

describe("dashboard model", () => {
  afterEach(cleanup);

  it("ranks findings by severity, confidence, and stable ID", () => {
    const critical = { ...finding, id: "critical", severity: "critical" as const };
    const high = { ...finding, id: "high", severity: "high" as const, confidence: 0.9 };
    const highLowerConfidence = {
      ...finding,
      id: "high-lower-confidence",
      severity: "high" as const,
      confidence: 0.7
    };
    const highEarlierId = { ...high, id: "high-a" };

    expect(
      rankDashboardFindings([finding, highLowerConfidence, high, critical, highEarlierId]).map(
        (item) => item.id
      )
    ).toEqual(["critical", "high", "high-a", "high-lower-confidence", "medium"]);
    expect(selectNextBestAction([finding, high])).toMatchObject({ id: "high" });
  });

  it("counts each severity and rejects selected findings outside the active queue", () => {
    const critical = { ...finding, id: "critical", severity: "critical" as const };
    const low = { ...finding, id: "low", severity: "low" as const };
    const info = { ...finding, id: "info", severity: "info" as const };

    expect(countDashboardFindings([critical, critical, low, info])).toEqual({
      critical: 2,
      high: 0,
      medium: 0,
      low: 1,
      info: 1
    });
    expect(selectDashboardFinding([critical], "missing")).toBeUndefined();
    expect(selectDashboardFinding([critical], critical.id)).toBe(critical);
  });

  it("renders health, a next action, and keyboard-native priority selection", () => {
    const critical = { ...finding, id: "critical", severity: "critical" as const };
    const onOpen = vi.fn();
    const onSelect = vi.fn();

    render(<VaultHealthSummary vaultLabel="Test vault" findings={[critical, finding]} />);
    expect(screen.getByText("Critical 1")).toBeInTheDocument();
    expect(screen.getByText("Medium 1")).toBeInTheDocument();

    render(<NextBestAction finding={critical} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /review critical finding/i }));
    expect(onOpen).toHaveBeenCalledWith("critical");

    render(
      <PriorityFindings
        findings={[finding, critical]}
        selectedFindingId="critical"
        onSelect={onSelect}
      />
    );
    const selected = screen.getByRole("button", { name: /critical.*missing target.*selected/i });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    selected.focus();
    expect(selected).toHaveFocus();
    fireEvent.click(selected);
    expect(onSelect).toHaveBeenCalledWith("critical");
  });

  it("does not expose an action button without a finding", () => {
    render(<NextBestAction onOpen={vi.fn()} />);
    expect(screen.getByText("No findings need review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review/i })).toBeNull();
  });
});
