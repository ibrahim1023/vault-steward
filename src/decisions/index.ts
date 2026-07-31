export type Decision = {
  id: string;
  rationale: string | null;
  supersedes: string | null;
  project: string | null;
  relatedDecision: string | null;
  evidenceLocator: string;
};
export function indexDecision(path: string, frontmatter: Record<string, unknown>): Decision | null {
  if (frontmatter.kind !== "decision") return null;
  return {
    id: path,
    rationale: typeof frontmatter.rationale === "string" ? frontmatter.rationale : null,
    supersedes: typeof frontmatter.supersedes === "string" ? frontmatter.supersedes : null,
    project: typeof frontmatter.project === "string" ? frontmatter.project : null,
    relatedDecision:
      typeof frontmatter.relatedDecision === "string" ? frontmatter.relatedDecision : null,
    evidenceLocator: "frontmatter:kind"
  };
}

export type DecisionIssueKind =
  | "missing-rationale"
  | "supersedes-cycle"
  | "missing-project-target"
  | "missing-related-decision-target";

export function checkDecisions(
  decisions: readonly Decision[],
  knownNotePaths: readonly string[] = []
): Array<{ id: string; kind: DecisionIssueKind; evidenceLocator: string }> {
  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  const knownPaths = new Set(knownNotePaths);
  return decisions.flatMap((decision) => {
    const issues: Array<{ id: string; kind: DecisionIssueKind; evidenceLocator: string }> =
      decision.rationale
        ? []
        : [
            {
              id: decision.id,
              kind: "missing-rationale",
              evidenceLocator: decision.evidenceLocator
            }
          ];
    if (decision.project && !resolvesKnownPath(decision.project, knownPaths)) {
      issues.push({
        id: decision.id,
        kind: "missing-project-target",
        evidenceLocator: decision.evidenceLocator
      });
    }
    if (decision.relatedDecision && !resolvesKnownPath(decision.relatedDecision, knownPaths)) {
      issues.push({
        id: decision.id,
        kind: "missing-related-decision-target",
        evidenceLocator: decision.evidenceLocator
      });
    }
    const seen = new Set<string>();
    let current: Decision | undefined = decision;
    while (current?.supersedes) {
      if (seen.has(current.id)) {
        issues.push({
          id: decision.id,
          kind: "supersedes-cycle",
          evidenceLocator: decision.evidenceLocator
        });
        break;
      }
      seen.add(current.id);
      current = byId.get(current.supersedes);
    }
    return issues;
  });
}

function resolvesKnownPath(value: string, knownPaths: ReadonlySet<string>): boolean {
  const path = value.endsWith(".md") ? value : `${value}.md`;
  return knownPaths.has(value) || knownPaths.has(path);
}
