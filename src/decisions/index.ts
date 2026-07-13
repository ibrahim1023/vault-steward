export type Decision = { id: string; rationale: string | null; supersedes: string | null };
export function indexDecision(path: string, frontmatter: Record<string, unknown>): Decision | null {
  if (frontmatter.kind !== "decision") return null;
  return {
    id: path,
    rationale: typeof frontmatter.rationale === "string" ? frontmatter.rationale : null,
    supersedes: typeof frontmatter.supersedes === "string" ? frontmatter.supersedes : null
  };
}

export function checkDecisions(
  decisions: readonly Decision[]
): Array<{ id: string; kind: "missing-rationale" | "supersedes-cycle" }> {
  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  return decisions.flatMap((decision) => {
    const issues: Array<{ id: string; kind: "missing-rationale" | "supersedes-cycle" }> =
      decision.rationale ? [] : [{ id: decision.id, kind: "missing-rationale" }];
    const seen = new Set<string>();
    let current: Decision | undefined = decision;
    while (current?.supersedes) {
      if (seen.has(current.id)) {
        issues.push({ id: decision.id, kind: "supersedes-cycle" });
        break;
      }
      seen.add(current.id);
      current = byId.get(current.supersedes);
    }
    return issues;
  });
}
