import { describe, expect, it } from "vitest";

import {
  countDashboardFindings,
  rankDashboardFindings,
  selectDashboardFinding,
  selectNextBestAction
} from "../../src/ui/dashboard.js";

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
});
