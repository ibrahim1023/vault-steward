export type Decision = { id: string; rationale: string | null; supersedes: string | null };
export function indexDecision(path: string, frontmatter: Record<string, unknown>): Decision | null {
  if (frontmatter.kind !== "decision") return null;
  return {
    id: path,
    rationale: typeof frontmatter.rationale === "string" ? frontmatter.rationale : null,
    supersedes: typeof frontmatter.supersedes === "string" ? frontmatter.supersedes : null
  };
}
