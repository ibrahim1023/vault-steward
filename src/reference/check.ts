import type { Finding, FindingType } from "../contracts/index.js";
import { normalizeAnchor, normalizeVaultPath, type ScanSnapshot } from "../scanner/scan.js";

type ResolvedTarget = { path: string; anchor?: string };

export function checkReferenceIntegrity(scan: ScanSnapshot): Finding[] {
  const notesByPath = new Map(scan.notes.map((note) => [note.path, note]));
  const findings: Finding[] = [];

  for (const note of scan.notes) {
    for (const reference of note.references) {
      if (reference.kind === "markdown" && isAllowedExternalUri(reference.rawTarget)) {
        continue;
      }

      const resolved = resolveTarget(reference.rawTarget, note.path, reference.kind === "markdown");
      if (resolved === null) {
        findings.push(
          createFinding(
            scan.id,
            note.path,
            reference,
            "invalid-reference",
            "outside or unsupported"
          )
        );
        continue;
      }

      const target = notesByPath.get(resolved.path);
      const targetExists = target !== undefined;
      const anchorExists =
        resolved.anchor === undefined ||
        target?.headings.some((heading) => normalizeAnchor(heading) === resolved.anchor);

      if (!targetExists || !anchorExists) {
        findings.push(
          createFinding(scan.id, note.path, reference, "broken-reference", "missing target")
        );
      }
    }
  }

  return findings;
}

function isAllowedExternalUri(target: string): boolean {
  return /^https?:/i.test(target);
}

function resolveTarget(
  rawTarget: string,
  sourcePath: string,
  isRelativeMarkdownLink: boolean
): ResolvedTarget | null {
  const [rawPath, rawAnchor] = rawTarget.split("#", 2);
  const path = normalizeVaultPath(rawPath ?? "");

  if (!path || path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return null;
  }

  const resolvedPath = normalizeResolvedPath(
    isRelativeMarkdownLink ? `${directoryOf(sourcePath)}/${path}` : path
  );
  if (!resolvedPath) return null;
  const withExtension = resolvedPath.includes(".") ? resolvedPath : `${resolvedPath}.md`;
  const anchor = rawAnchor === undefined ? undefined : normalizeAnchor(rawAnchor);
  return anchor === "" && rawAnchor !== undefined
    ? null
    : { path: withExtension, ...(anchor ? { anchor } : {}) };
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function normalizeResolvedPath(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("/") : null;
}

function createFinding(
  scanId: string,
  notePath: string,
  reference: { locator: string; excerpt: string },
  type: FindingType,
  reason: string
): Finding {
  const invalid = type === "invalid-reference";
  return {
    schemaVersion: 1,
    id: `${scanId}:${notePath}:${reference.locator}:${type}`,
    scanId,
    type,
    severity: "medium",
    evidence: [{ notePath, locator: reference.locator, excerpt: reference.excerpt }],
    affectedNoteIds: [notePath],
    explanation: invalid
      ? `The reference target is ${reason} and cannot be resolved inside this vault.`
      : `The reference has a ${reason} in this scan snapshot.`,
    suggestedFixes: [{ description: "Update the reference or create the missing target." }],
    confidence: 1,
    status: "open"
  };
}
