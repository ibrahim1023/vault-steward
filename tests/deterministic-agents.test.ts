import { describe, expect, it } from "vitest";
import { normalizeFindings } from "../src/coordinator/normalize.js";
import { checkDecisions, indexDecision } from "../src/decisions/index.js";
import { checkFrontmatter } from "../src/schema/check.js";
import { checkTasks } from "../src/tasks/check.js";

describe("deterministic agents", () => {
  it("validates schemas, tasks, decisions, and deduplicates review findings", () => {
    expect(
      checkFrontmatter({ status: "bad" }, { required: ["owner"], enums: { status: ["open"] } })
    ).toHaveLength(2);
    expect(
      checkTasks(
        "- [ ] Launch due:2026-01-01 abandoned:true ^launch\n- [ ] Again project:p owner:a ^launch",
        "2026-07-13"
      ).map((issue) => issue.kind)
    ).toEqual(expect.arrayContaining(["orphaned", "overdue", "abandoned", "duplicated"]));
    expect(indexDecision("Decisions/A.md", { kind: "decision" })).toEqual({
      id: "Decisions/A.md",
      rationale: null,
      supersedes: null,
      project: null,
      relatedDecision: null,
      evidenceLocator: "frontmatter:kind"
    });
    expect(
      checkDecisions([
        {
          id: "a",
          rationale: null,
          supersedes: "b",
          project: null,
          relatedDecision: null,
          evidenceLocator: "frontmatter:kind"
        },
        {
          id: "b",
          rationale: "ok",
          supersedes: "a",
          project: null,
          relatedDecision: null,
          evidenceLocator: "frontmatter:kind"
        }
      ]).map((issue) => issue.kind)
    ).toEqual(expect.arrayContaining(["missing-rationale", "supersedes-cycle"]));
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
