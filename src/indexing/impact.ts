import type { ScanSnapshot } from "../scanner/scan.js";
import { replaceInternalReference } from "../review/propose.js";

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
  safeRenameTargets: Array<{
    sourcePath: string;
    sourceRevision: string;
    locator: string;
    currentReference: string;
    replacement: string;
  }>;
};

export function analyzeChangeImpact(change: VaultChange, snapshot: ScanSnapshot): ChangeImpact {
  const target =
    change.kind === "rename" ? stripExtension(change.oldPath) : stripExtension(change.path);
  const inboundReferences = snapshot.notes.flatMap((note) =>
    note.references.flatMap((reference) =>
      referenceTargetForImpact(reference.rawTarget, reference.kind, note.path) === target
        ? [
            {
              sourcePath: note.path,
              sourceRevision: note.revision,
              locator: reference.locator,
              excerpt: reference.excerpt
            }
          ]
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
          rewriteUnambiguousInternalReference(reference, target, change.path)
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

function rewriteUnambiguousInternalReference(
  reference: {
    sourcePath: string;
    sourceRevision: string;
    locator: string;
    excerpt: string;
  },
  target: string,
  nextPath: string
): ChangeImpact["safeRenameTargets"] {
  const replacement = replaceInternalReference(reference.excerpt, reference.sourcePath, nextPath);
  if (!replacement) return [];
  return [
    {
      sourcePath: reference.sourcePath,
      sourceRevision: reference.sourceRevision,
      locator: reference.locator,
      currentReference: reference.excerpt,
      replacement
    }
  ];
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

function referenceTargetForImpact(
  rawTarget: string,
  kind: "wiki" | "embed" | "markdown",
  sourcePath: string
): string | null {
  if (kind !== "markdown") return stripAnchor(rawTarget);
  const [encodedPath] = rawTarget.split("#", 1);
  if (!encodedPath || encodedPath.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(encodedPath))
    return null;

  let path: string;
  try {
    path = decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
  const parts = sourcePath.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    if (part.includes("\\") || hasControlCharacters(part)) return null;
    parts.push(part);
  }
  return stripExtension(parts.join("/"));
}

function stripExtension(path: string): string {
  return path.replace(/\.md$/, "");
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
