import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activeDashboardFindings,
  compactDashboardFindings,
  countDashboardFindings,
  filterDashboardFindings,
  groupDashboardFindings,
  rankDashboardFindings,
  selectDashboardFinding,
  selectNextBestAction,
  type FindingQueueFilter
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

  it("keeps only open findings and groups each severity in ranked order", () => {
    const critical = { ...finding, id: "critical", severity: "critical" as const };
    const dismissed = { ...finding, id: "dismissed", status: "dismissed" as const };

    expect(activeDashboardFindings([finding, dismissed])).toEqual([finding]);
    expect(groupDashboardFindings([finding, critical])).toMatchObject([
      { severity: "critical", findings: [{ id: "critical" }] },
      { severity: "medium", findings: [{ id: "medium" }] }
    ]);
  });

  it("compacts the ranked queue and filters visible finding fields", () => {
    const critical = { ...finding, id: "critical", severity: "critical" as const };
    const high = { ...finding, id: "high", severity: "high" as const };
    const medium = {
      ...finding,
      id: "medium",
      severity: "medium" as const,
      explanation: "Broken link from the home page",
      evidence: [{ notePath: "Home.md", locator: "heading:Home", excerpt: "[[Missing]]" }]
    };
    const low = { ...finding, id: "low", severity: "low" as const };

    expect(compactDashboardFindings([critical, high, medium, low])).toEqual([
      critical,
      high,
      medium
    ]);
    expect(compactDashboardFindings([critical, high, medium], 2).map((item) => item.id)).toEqual([
      "critical",
      "high"
    ]);
    expect(
      filterDashboardFindings([critical, medium], { severity: "medium", query: "  HOME " })
    ).toEqual([medium]);
    expect(
      filterDashboardFindings([critical, medium], { severity: "all", query: "broken link" })
    ).toEqual([medium]);
    expect(
      filterDashboardFindings([critical, medium], { severity: "all", query: "heading:home" })
    ).toEqual([medium]);
    expect(
      filterDashboardFindings([critical, medium], { severity: "critical", query: "broken link" })
    ).toEqual([]);
  });

  it("renders health, a next action, and keyboard-native priority selection", () => {
    const critical = { ...finding, id: "critical", severity: "critical" as const };
    const onOpen = vi.fn();
    const onSelect = vi.fn();

    render(<VaultHealthSummary vaultLabel="Test vault" findings={[critical, finding]} />);
    expect(screen.getByText("Critical 1")).toBeInTheDocument();
    expect(screen.getByText("Medium 1")).toBeInTheDocument();
    expect(screen.getByText("Critical 1").closest("button")).toBeNull();

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
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /medium finding: missing target, source home\.md, line:1/i
      })
    ).toHaveClass("finding-row-severity-medium");
    selected.focus();
    expect(selected).toHaveFocus();
    fireEvent.click(selected);
    expect(onSelect).toHaveBeenCalledWith("critical");
  });

  it("keeps the review queue compact until the user expands it", () => {
    const critical = {
      ...finding,
      id: "critical",
      severity: "critical" as const,
      explanation: "Critical finding",
      evidence: [{ notePath: "Notes/Critical.md", locator: "line:1", excerpt: "critical" }]
    };
    const high = {
      ...finding,
      id: "high",
      severity: "high" as const,
      explanation: "High finding",
      evidence: [{ notePath: "Notes/High.md", locator: "line:2", excerpt: "high" }]
    };
    const medium = {
      ...finding,
      id: "medium",
      severity: "medium" as const,
      explanation: "Medium finding",
      evidence: [{ notePath: "Notes/Medium.md", locator: "line:3", excerpt: "medium" }]
    };
    const low = {
      ...finding,
      id: "low",
      severity: "low" as const,
      explanation: "Low finding",
      evidence: [{ notePath: "Notes/Low.md", locator: "line:4", excerpt: "low" }]
    };
    const onSelect = vi.fn();

    function Queue() {
      const [expanded, setExpanded] = useState(false);
      const [filter, setFilter] = useState<FindingQueueFilter>({ severity: "all", query: "" });
      return (
        <PriorityFindings
          findings={[low, medium, high, critical]}
          selectedFindingId="critical"
          onSelect={onSelect}
          expanded={expanded}
          filter={filter}
          onFilterChange={setFilter}
          onToggleExpanded={() => setExpanded((value) => !value)}
        />
      );
    }

    render(<Queue />);

    expect(screen.getAllByRole("button", { name: /finding:/i })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /low finding/i })).toBeNull();
    expect(screen.queryByLabelText("Finding severity filter")).toBeNull();
    expect(screen.queryByLabelText("Search findings")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View all findings" }));

    expect(screen.getAllByRole("button", { name: /finding:/i })).toHaveLength(4);
    expect(screen.getByText("Notes/Low.md")).toBeInTheDocument();
    expect(screen.getByText("line:4")).toBeInTheDocument();
    expect(screen.getByLabelText("Finding severity filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Search findings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /critical finding.*selected/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.change(screen.getByLabelText("Search findings"), {
      target: { value: "does not exist" }
    });
    expect(screen.getByText("No findings match the current filters.")).toBeInTheDocument();
    expect(screen.queryByText("No findings need review.")).toBeNull();
  });

  it("does not expose an action button without a finding", () => {
    render(<NextBestAction finding={undefined} onOpen={vi.fn()} />);
    expect(screen.getByText("No findings need review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review/i })).toBeNull();
  });
});
