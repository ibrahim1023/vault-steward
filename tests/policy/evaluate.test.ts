import { describe, expect, it } from "vitest";

import { evaluatePolicies, extractPolicyFacts } from "../../src/policy/evaluate.js";
import { parsePolicy } from "../../src/policy/parse.js";

describe("policy facts and evaluation", () => {
  it("evaluates every MVP policy example against deterministic facts", () => {
    const facts = extractPolicyFacts([
      { path: "Projects/Atlas.md", frontmatter: { kind: "project", status: "archived" } },
      {
        path: "Tasks/Launch.md",
        frontmatter: { kind: "task", status: "open", project: "Projects/Atlas.md" }
      },
      { path: "Decisions/Choice.md", frontmatter: { kind: "decision" } }
    ]);
    const parsed = parsePolicy(`
id: governance
version: 1
rules:
  - { id: project-owner, fact: project.owner, operator: required, severity: high }
  - { id: task-due, fact: task.due, operator: required, severity: medium }
  - { id: decision-rationale, fact: decision.rationale, operator: required, severity: medium }
  - { id: archived-open, fact: project.archived_open_tasks, operator: forbidden, severity: high }
  - { id: approved-status, fact: status.approved, operator: equals, value: true, severity: low }
`);
    if (!parsed.ok) throw new Error(parsed.diagnostics.join(", "));

    expect(evaluatePolicies([parsed.value], facts).map((finding) => finding.ruleId)).toEqual([
      "project-owner",
      "task-due",
      "decision-rationale",
      "archived-open",
      "approved-status"
    ]);
  });
});
