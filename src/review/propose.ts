import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";

export type ProposalSource = { path: string; revision: string; content: string };
export type ProposalResult =
  { applicable: true; proposal: Proposal } | { applicable: false; reason: string };

export function proposeFix(
  finding: Finding,
  source: ProposalSource,
  target: string
): ProposalResult {
  const evidence = finding.evidence[0];
  if (finding.type !== "broken-reference" || !evidence || evidence.notePath !== source.path)
    return { applicable: false, reason: "No deterministic fix is available for this finding." };
  const replacement = replaceInternalReference(evidence.excerpt, source.path, target);
  if (!replacement)
    return { applicable: false, reason: "The reference replacement is unsafe or ambiguous." };
  const start = source.content.indexOf(evidence.excerpt);
  if (start < 0)
    return { applicable: false, reason: "The snapshot evidence is no longer present." };
  return {
    applicable: true,
    proposal: {
      schemaVersion: 1,
      id: `proposal:${finding.id}`,
      findingId: finding.id,
      scanId: finding.scanId,
      explanation: "Replace the broken internal reference with the selected vault target.",
      operations: [
        {
          kind: "replace-range",
          path: source.path,
          sourceRevision: source.revision,
          start,
          end: start + evidence.excerpt.length,
          expected: evidence.excerpt,
          replacement
        }
      ]
    }
  };
}

export function replaceInternalReference(
  excerpt: string,
  sourcePath: string,
  target: string
): string | null {
  const targetPath = normalizeTargetPath(target);
  if (!targetPath) return null;

  const wiki = /^(!)?\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]$/.exec(excerpt);
  if (wiki) {
    const prefix = wiki[1] ? "!" : "";
    const anchor = wiki[3] ?? "";
    const label = wiki[4] ? `|${wiki[4]}` : "";
    return `${prefix}[[${stripExtension(targetPath)}${anchor}${label}]]`;
  }

  const markdown = /^(!)?\[([^\]]*)\]\(([^\s()]+)\)$/.exec(excerpt);
  if (!markdown || !isSafeInternalMarkdownTarget(markdown[3] ?? "", sourcePath)) return null;
  const rawTarget = markdown[3] ?? "";
  const [, rawAnchor] = rawTarget.split("#", 2);
  const anchor = rawAnchor === undefined ? "" : `#${rawAnchor}`;
  const prefix = markdown[1] ? "!" : "";
  return `${prefix}[${markdown[2] ?? ""}](${encodeMarkdownPath(relativeMarkdownPath(sourcePath, targetPath))}${anchor})`;
}

function normalizeTargetPath(target: string): string | null {
  if (
    !target ||
    target.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    ["[", "]", "#", "|", "\\"].some((character) => target.includes(character))
  )
    return null;
  const path = target.endsWith(".md") ? target : `${target}.md`;
  const parts = path.split("/");
  return parts.some((part) => !part || part === "." || part === ".." || hasControlCharacters(part))
    ? null
    : path;
}

function isSafeInternalMarkdownTarget(target: string, sourcePath: string): boolean {
  const [path, anchor] = target.split("#", 2);
  if (!path) return false;
  if (
    path.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    (anchor !== undefined && anchor.length === 0)
  )
    return false;
  let depth = sourcePath.split("/").length - 1;
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (depth === 0) return false;
      depth -= 1;
      continue;
    }
    if (part.includes("\\") || hasControlCharacters(part)) return false;
    depth += 1;
  }
  return true;
}

function relativeMarkdownPath(sourcePath: string, targetPath: string): string {
  const sourceDirectory = sourcePath.split("/").slice(0, -1);
  const targetParts = targetPath.split("/");
  let shared = 0;
  while (sourceDirectory[shared] === targetParts[shared]) shared += 1;
  const parentSegments = sourceDirectory.slice(shared).map(() => "..");
  return [...parentSegments, ...targetParts.slice(shared)].join("/");
}

function encodeMarkdownPath(path: string): string {
  return path
    .split("/")
    .map((part) => (part === ".." ? part : encodeURIComponent(part)))
    .join("/");
}

function stripExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
