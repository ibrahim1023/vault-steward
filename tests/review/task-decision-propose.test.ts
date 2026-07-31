import { describe, expect, it } from "vitest";

import {
  proposeDecisionRepair,
  proposeTaskRepair
} from "../../src/review/task-decision-propose.js";

const taskFinding = {
  schemaVersion: 1 as const,
  id: "task-finding",
  scanId: "scan-1",
  type: "task" as const,
  severity: "medium" as const,
  evidence: [
    {
      notePath: "Work.md",
      locator: "line:2",
      excerpt: "- [ ] Ship owner:ada project:atlas due:2026-07-01 abandoned:true ^ship"
    }
  ],
  affectedNoteIds: ["Work.md"],
  explanation: "Task ship is overdue.",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("task and decision deterministic proposals", () => {
  it("constructs a due-date patch only from a supplied bounded candidate", () => {
    const source = {
      path: "Work.md",
      revision: "revision-1",
      content: `# Work\n${taskFinding.evidence[0]!.excerpt}\n`
    };
    expect(
      proposeTaskRepair(
        taskFinding,
        source,
        {
          schemaVersion: 1,
          kind: "replace-due-date",
          scanId: "scan-1",
          findingId: "task-finding",
          taskId: "ship",
          candidateId: "due-2026-08-15"
        },
        [{ id: "due-2026-08-15", value: "2026-08-15" }]
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [{ expected: "due:2026-07-01", replacement: "due:2026-08-15", path: "Work.md" }]
      }
    });
  });

  it("refuses task completion without an explicit completion marker on the same task", () => {
    expect(
      proposeTaskRepair(
        taskFinding,
        { path: "Work.md", revision: "revision-1", content: taskFinding.evidence[0]!.excerpt },
        {
          schemaVersion: 1,
          kind: "mark-complete",
          scanId: "scan-1",
          findingId: "task-finding",
          taskId: "ship"
        },
        []
      )
    ).toMatchObject({ applicable: false });
  });

  it("checks an unchecked task only when its own metadata marks it complete", () => {
    const completionFinding = {
      ...taskFinding,
      explanation: "Task ship is completion-pending.",
      evidence: [
        {
          ...taskFinding.evidence[0]!,
          excerpt: "- [ ] Ship owner:ada project:atlas status:done ^ship"
        }
      ]
    };
    expect(
      proposeTaskRepair(
        completionFinding,
        {
          path: "Work.md",
          revision: "revision-1",
          content: completionFinding.evidence[0]!.excerpt
        },
        {
          schemaVersion: 1,
          kind: "mark-complete",
          scanId: "scan-1",
          findingId: "task-finding",
          taskId: "ship"
        },
        []
      )
    ).toMatchObject({
      applicable: true,
      proposal: { operations: [{ expected: "- [ ]", replacement: "- [x]" }] }
    });
  });

  it("updates only one decision frontmatter field and requires cited active evidence", () => {
    const finding = {
      ...taskFinding,
      id: "decision-finding",
      type: "decision" as const,
      evidence: [
        { notePath: "Decisions/ADR-1.md", locator: "frontmatter:kind", excerpt: "decision" }
      ]
    };
    const source = {
      path: "Decisions/ADR-1.md",
      revision: "revision-1",
      content: "---\nkind: decision\n---\n# Decision\n"
    };
    const rationale =
      "The launch window remains appropriate because the linked readiness review records completed validation and the project owner approved the schedule.";
    expect(
      proposeDecisionRepair(
        finding,
        source,
        {
          schemaVersion: 1,
          kind: "set-rationale",
          scanId: "scan-1",
          findingId: "decision-finding",
          decisionId: "Decisions/ADR-1.md",
          rationale,
          evidenceIds: ["evidence-1"]
        },
        [],
        ["evidence-1"]
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          expect.objectContaining({
            expected: "---\n",
            replacement: expect.stringContaining("rationale:")
          })
        ]
      }
    });
  });

  it("rejects uncited rationale and decision candidates that were not supplied", () => {
    const finding = {
      ...taskFinding,
      id: "decision-finding",
      type: "decision" as const,
      evidence: [
        { notePath: "Decisions/ADR-1.md", locator: "frontmatter:kind", excerpt: "decision" }
      ]
    };
    const source = {
      path: "Decisions/ADR-1.md",
      revision: "revision-1",
      content: "---\nkind: decision\n---\n# Decision\n"
    };
    expect(
      proposeDecisionRepair(
        finding,
        source,
        {
          schemaVersion: 1,
          kind: "link-project",
          scanId: "scan-1",
          findingId: "decision-finding",
          decisionId: "Decisions/ADR-1.md",
          candidateId: "project-unknown"
        },
        [],
        ["evidence-1"]
      )
    ).toMatchObject({ applicable: false });
  });
});
