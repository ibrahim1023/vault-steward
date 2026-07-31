import { describe, expect, it } from "vitest";

import {
  buildDecisionRepairCandidates,
  buildTaskDecisionCandidates
} from "../../src/review/task-decision-candidates.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

describe("task and decision repair candidates", () => {
  it("derives owner, project, due, and decision candidates only from the active snapshot context", () => {
    const snapshot = scanVaultFiles([
      {
        path: "Work.md",
        content:
          "- [ ] Ship owner:ada project:Projects/Northstar.md due:2026-07-01 ^ship\n[[Decisions/ADR-1]]",
        revision: "work"
      },
      {
        path: "Projects/Northstar.md",
        content: "---\nkind: project\nowner: lee\ndue: 2026-08-15\n---\n# Northstar",
        revision: "project"
      },
      {
        path: "Decisions/ADR-1.md",
        content: "---\nkind: decision\ndue: 2026-08-20\n---\n# ADR",
        revision: "decision"
      },
      {
        path: "Projects/Other.md",
        content: "---\nkind: project\nowner: sam\ndue: 2027-01-01\n---\n# Other",
        revision: "other"
      }
    ]);

    const candidates = buildTaskDecisionCandidates(snapshot, "Work.md", "ship");
    expect(candidates.owners.map((item) => item.value)).toEqual(["lee", "sam"]);
    expect(candidates.projects.map((item) => item.value)).toEqual([
      "Projects/Northstar.md",
      "Projects/Other.md"
    ]);
    expect(candidates.dueDates.map((item) => item.value)).toEqual(["2026-08-15", "2026-08-20"]);
    expect(candidates.decisions.map((item) => item.value)).toEqual(["Decisions/ADR-1.md"]);
  });

  it("fails closed for missing task context", () => {
    const snapshot = scanVaultFiles([{ path: "Work.md", content: "# Work", revision: "work" }]);
    expect(buildTaskDecisionCandidates(snapshot, "Work.md", "missing")).toEqual({
      owners: [],
      projects: [],
      dueDates: [],
      decisions: []
    });
  });

  it("derives decision association candidates only from existing snapshot notes", () => {
    const snapshot = scanVaultFiles([
      { path: "Decisions/ADR-1.md", content: "---\nkind: decision\n---", revision: "one" },
      { path: "Decisions/ADR-2.md", content: "---\nkind: decision\n---", revision: "two" },
      { path: "Projects/Northstar.md", content: "---\nkind: project\n---", revision: "project" }
    ]);
    expect(buildDecisionRepairCandidates(snapshot, "Decisions/ADR-1.md")).toMatchObject({
      projects: [{ value: "Projects/Northstar.md" }],
      decisions: [{ value: "Decisions/ADR-2.md" }]
    });
  });
});
