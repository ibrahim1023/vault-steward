import { describe, expect, it } from "vitest";
import { groupMaintenanceFindings } from "../../src/maintenance/queue.js";

const finding = (id: string, severity: "low" | "high", locator = "line:1") => ({
  schemaVersion: 1 as const,
  id,
  scanId: "scan",
  type: "task" as const,
  severity,
  evidence: [{ notePath: "Tasks.md", locator, excerpt: "- [ ] item" }],
  affectedNoteIds: ["Tasks.md"],
  explanation: id,
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
});

describe("maintenance queue", () => {
  it("groups duplicate evidence and ranks group representatives", () => {
    const groups = groupMaintenanceFindings([
      finding("low", "low"),
      finding("duplicate", "low"),
      finding("high", "high", "line:2")
    ]);
    expect(groups.map((group) => [group.representative.id, group.findings.length])).toEqual([
      ["high", 1],
      ["duplicate", 2]
    ]);
  });
});
