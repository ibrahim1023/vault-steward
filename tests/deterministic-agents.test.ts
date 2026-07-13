import { describe, expect, it } from "vitest";
import { normalizeFindings } from "../src/coordinator/normalize.js";
import { indexDecision } from "../src/decisions/index.js";
import { checkFrontmatter } from "../src/schema/check.js";
import { checkTasks } from "../src/tasks/check.js";

describe("deterministic agents", () => {
  it("validates schemas, tasks, decisions, and deduplicates review findings", () => {
    expect(
      checkFrontmatter({ status: "bad" }, { required: ["owner"], enums: { status: ["open"] } })
    ).toHaveLength(2);
    expect(
      checkTasks(
        "- [ ] Launch due:2026-01-01 ^launch\n- [ ] Again project:p ^launch",
        "2026-07-13"
      ).map((issue) => issue.kind)
    ).toEqual(expect.arrayContaining(["orphaned", "overdue", "duplicated"]));
    expect(indexDecision("Decisions/A.md", { kind: "decision" })).toEqual({
      id: "Decisions/A.md",
      rationale: null,
      supersedes: null
    });
    const finding = {
      schemaVersion: 1 as const,
      id: "a",
      scanId: "s",
      type: "broken-reference" as const,
      severity: "high" as const,
      evidence: [{ notePath: "A.md", locator: "line:1", excerpt: "x" }],
      affectedNoteIds: ["A.md"],
      explanation: "x",
      suggestedFixes: [],
      confidence: 1,
      status: "open" as const
    };
    expect(normalizeFindings([finding, { ...finding, id: "b" }]).map((item) => item.id)).toEqual([
      "a"
    ]);
  });
});
