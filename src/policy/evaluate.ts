import type { Policy, PolicyRule } from "./parse.js";

export type PolicyFactSource = { path: string; frontmatter: Record<string, unknown> };
export type PolicyFacts = Map<string, Array<{ path: string; value: string | boolean | null }>>;
export type PolicyViolation = {
  policyId: string;
  ruleId: string;
  severity: PolicyRule["severity"];
  path: string;
  fact: string;
};

export function extractPolicyFacts(notes: readonly PolicyFactSource[]): PolicyFacts {
  const facts: PolicyFacts = new Map();
  const projects = notes.filter((note) => note.frontmatter.kind === "project");
  const openTasks = notes.filter(
    (note) => note.frontmatter.kind === "task" && note.frontmatter.status === "open"
  );
  for (const note of notes) {
    const kind = note.frontmatter.kind;
    if (kind === "project")
      add(facts, "project.owner", note.path, stringOrNull(note.frontmatter.owner));
    if (kind === "task") add(facts, "task.due", note.path, stringOrNull(note.frontmatter.due));
    if (kind === "decision")
      add(facts, "decision.rationale", note.path, stringOrNull(note.frontmatter.rationale));
    if (kind === "project") {
      const hasOpenTask = openTasks.some((task) => task.frontmatter.project === note.path);
      add(
        facts,
        "project.archived_open_tasks",
        note.path,
        note.frontmatter.status === "archived" && hasOpenTask
      );
    }
    add(facts, "status.approved", note.path, isApprovedStatus(note.frontmatter.status));
  }
  if (projects.length === 0) facts.set("project.owner", []);
  return facts;
}

export function evaluatePolicies(
  policies: readonly Policy[],
  facts: PolicyFacts
): PolicyViolation[] {
  return policies.flatMap((policy) =>
    policy.enabled
      ? policy.rules.flatMap((rule) =>
          (facts.get(rule.fact) ?? []).flatMap((entry) =>
            violates(rule, entry.value)
              ? [
                  {
                    policyId: policy.id,
                    ruleId: rule.id,
                    severity: rule.severity,
                    path: entry.path,
                    fact: rule.fact
                  }
                ]
              : []
          )
        )
      : []
  );
}

function violates(rule: PolicyRule, value: string | boolean | null): boolean {
  if (rule.operator === "required") return value === null || value === "";
  if (rule.operator === "forbidden")
    return value === true || (typeof value === "string" && value !== "");
  if (rule.operator === "equals") return value !== rule.value;
  return value === rule.value;
}

function add(facts: PolicyFacts, fact: string, path: string, value: string | boolean | null): void {
  facts.set(fact, [...(facts.get(fact) ?? []), { path, value }]);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isApprovedStatus(value: unknown): boolean {
  return value === "open" || value === "in-progress" || value === "done" || value === "archived";
}
