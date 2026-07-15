import type { ScanSnapshot } from "../scanner/scan.js";

export type VaultChange =
  { kind: "rename"; oldPath: string; path: string } | { kind: "delete"; path: string };

export type ChangeImpact = {
  change: VaultChange;
  inboundReferences: Array<{ sourcePath: string; locator: string; excerpt: string }>;
  aliasDependents: string[];
  taskDependents: string[];
  decisionDependents: string[];
  policyDependents: string[];
  affectedPaths: string[];
  safeRenameTargets: Array<{ sourcePath: string; replacement: string }>;
};

export function analyzeChangeImpact(change: VaultChange, snapshot: ScanSnapshot): ChangeImpact {
  const target =
    change.kind === "rename" ? stripExtension(change.oldPath) : stripExtension(change.path);
  const inboundReferences = snapshot.notes.flatMap((note) =>
    note.references.flatMap((reference) =>
      stripAnchor(reference.rawTarget) === target
        ? [{ sourcePath: note.path, locator: reference.locator, excerpt: reference.excerpt }]
        : []
    )
  );
  const aliasDependents = snapshot.notes.flatMap((note) =>
    stringValues(note.frontmatter.aliases).some((alias) => alias === target) ? [note.path] : []
  );
  const taskDependents = snapshot.notes.flatMap((note) =>
    matchesAnyFrontmatterValue(note.frontmatter, ["project", "dependsOn", "blockedBy"], target)
      ? [note.path]
      : []
  );
  const decisionDependents = snapshot.notes.flatMap((note) =>
    matchesAnyFrontmatterValue(note.frontmatter, ["supersedes", "dependsOn"], target)
      ? [note.path]
      : []
  );
  const policyDependents = snapshot.notes.flatMap((note) =>
    matchesAnyFrontmatterValue(note.frontmatter, ["policyFor", "appliesTo", "scope"], target)
      ? [note.path]
      : []
  );
  const safeRenameTargets =
    change.kind === "rename"
      ? inboundReferences.flatMap((reference) =>
          rewriteUnambiguousWikiLink(reference.sourcePath, reference.excerpt, target, change.path)
        )
      : [];
  return {
    change,
    inboundReferences,
    aliasDependents: uniqueSorted(aliasDependents),
    taskDependents: uniqueSorted(taskDependents),
    decisionDependents: uniqueSorted(decisionDependents),
    policyDependents: uniqueSorted(policyDependents),
    affectedPaths: uniqueSorted([
      ...inboundReferences.map((reference) => reference.sourcePath),
      ...aliasDependents,
      ...taskDependents,
      ...decisionDependents,
      ...policyDependents
    ]),
    safeRenameTargets
  };
}

function rewriteUnambiguousWikiLink(
  sourcePath: string,
  excerpt: string,
  target: string,
  nextPath: string
): Array<{ sourcePath: string; replacement: string }> {
  const match = /^\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]$/.exec(excerpt);
  if (!match || stripExtension(match[1] ?? "") !== target) return [];
  const anchor = match[2] ?? "";
  const label = match[3] ? `|${match[3]}` : "";
  return [{ sourcePath, replacement: `[[${stripExtension(nextPath)}${anchor}${label}]]` }];
}

function matchesAnyFrontmatterValue(
  frontmatter: Record<string, unknown>,
  fields: readonly string[],
  target: string
): boolean {
  return fields.some((field) => stringValues(frontmatter[field]).some((value) => value === target));
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [stripExtension(value)];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  return [];
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stripAnchor(target: string): string {
  return target.split("#", 1)[0]?.replace(/\.md$/, "") ?? "";
}

function stripExtension(path: string): string {
  return path.replace(/\.md$/, "");
}
