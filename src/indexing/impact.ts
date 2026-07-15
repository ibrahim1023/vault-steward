import type { ScanSnapshot } from "../scanner/scan.js";

export type VaultChange =
  { kind: "rename"; oldPath: string; path: string } | { kind: "delete"; path: string };

export type ChangeImpact = {
  change: VaultChange;
  inboundReferences: Array<{ sourcePath: string; locator: string; excerpt: string }>;
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
  const safeRenameTargets =
    change.kind === "rename"
      ? inboundReferences.flatMap((reference) =>
          /^\[\[[^\]|]+(?:\|[^\]]+)?\]\]$/.test(reference.excerpt)
            ? [
                {
                  sourcePath: reference.sourcePath,
                  replacement: `[[${stripExtension(change.path)}]]`
                }
              ]
            : []
        )
      : [];
  return {
    change,
    inboundReferences,
    affectedPaths: [...new Set(inboundReferences.map((reference) => reference.sourcePath))].sort(),
    safeRenameTargets
  };
}

function stripAnchor(target: string): string {
  return target.split("#", 1)[0]?.replace(/\.md$/, "") ?? "";
}

function stripExtension(path: string): string {
  return path.replace(/\.md$/, "");
}
