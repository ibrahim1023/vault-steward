import {
  normalizeAnchor,
  normalizeVaultPath,
  type ParsedReference,
  type ScanSnapshot,
  type ScannedNote
} from "../scanner/scan.js";

export type ReferenceAnchor = {
  kind: "heading" | "block";
  value: string;
  normalized: string;
};

export type ReferenceResolution =
  | { status: "invalid"; reason: string }
  | { status: "missing"; requestedPath: string; anchor?: ReferenceAnchor }
  | { status: "ambiguous"; requestedPath: string; anchor?: ReferenceAnchor }
  | {
      status: "resolved";
      requestedPath: string;
      canonicalPath: string;
      note: ScannedNote;
      anchor?: ReferenceAnchor;
      anchorExists: boolean;
    };

export function resolveInternalReference(
  snapshot: ScanSnapshot,
  reference: Pick<ParsedReference, "kind" | "rawTarget">,
  sourcePath: string
): ReferenceResolution {
  const parsed = parseReferenceTarget(
    reference.rawTarget,
    sourcePath,
    reference.kind === "markdown"
  );
  if (!parsed) return { status: "invalid", reason: "outside or unsupported" };

  const exact = snapshot.notes.filter((note) => note.path === parsed.requestedPath);
  const basename =
    exact.length > 0
      ? []
      : snapshot.notes.filter(
          (note) => normalizedBasename(note.path) === normalizedBasename(parsed.requestedPath)
        );
  const aliases =
    exact.length > 0 || basename.length > 0
      ? []
      : snapshot.notes.filter((note) =>
          stringValues(note.frontmatter.aliases).some(
            (alias) => normalizeAlias(alias) === normalizeAlias(parsed.requestedPath)
          )
        );
  const candidates = exact.length > 0 ? exact : basename.length > 0 ? basename : aliases;
  if (candidates.length === 0)
    return {
      status: "missing",
      requestedPath: parsed.requestedPath,
      ...(parsed.anchor ? { anchor: parsed.anchor } : {})
    };
  if (candidates.length !== 1)
    return {
      status: "ambiguous",
      requestedPath: parsed.requestedPath,
      ...(parsed.anchor ? { anchor: parsed.anchor } : {})
    };

  const note = candidates[0]!;
  return {
    status: "resolved",
    requestedPath: parsed.requestedPath,
    canonicalPath: note.path,
    note,
    ...(parsed.anchor ? { anchor: parsed.anchor } : {}),
    anchorExists: parsed.anchor ? anchorExists(note, parsed.anchor) : true
  };
}

export function parseReferenceTarget(
  rawTarget: string,
  sourcePath: string,
  isRelativeMarkdownLink: boolean
): { requestedPath: string; anchor?: ReferenceAnchor } | null {
  const [rawPath, rawAnchor] = rawTarget.split("#", 2);
  const decodedPath = decodeComponent(rawPath ?? "");
  const decodedAnchor = rawAnchor === undefined ? undefined : decodeComponent(rawAnchor);
  if (decodedPath === null || decodedAnchor === null) return null;
  const path = normalizeVaultPath(decodedPath);
  if (!path || path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  const resolvedPath = normalizeResolvedPath(
    isRelativeMarkdownLink ? `${directoryOf(sourcePath)}/${path}` : path
  );
  if (!resolvedPath) return null;
  const requestedPath = hasFileExtension(resolvedPath) ? resolvedPath : `${resolvedPath}.md`;
  if (decodedAnchor === undefined) return { requestedPath };
  const anchor = parseAnchor(decodedAnchor);
  return anchor ? { requestedPath, anchor } : null;
}

export function referenceAnchorCandidates(
  note: ScannedNote
): Array<{ kind: "heading" | "block"; value: string; normalized: string }> {
  return [
    ...note.headings.map((heading) => ({
      kind: "heading" as const,
      value: heading,
      normalized: normalizeAnchor(heading)
    })),
    ...note.blockIds.map((blockId) => ({
      kind: "block" as const,
      value: blockId,
      normalized: normalizeBlockId(blockId)
    }))
  ].filter((candidate) => candidate.normalized.length > 0);
}

function anchorExists(note: ScannedNote, anchor: ReferenceAnchor): boolean {
  return anchor.kind === "heading"
    ? note.headings.some((heading) => normalizeAnchor(heading) === anchor.normalized)
    : note.blockIds.some((blockId) => normalizeBlockId(blockId) === anchor.normalized);
}

function parseAnchor(value: string): ReferenceAnchor | null {
  if (!value) return null;
  if (value.startsWith("^")) {
    const block = value.slice(1);
    return isBlockId(block)
      ? { kind: "block", value: block, normalized: normalizeBlockId(block) }
      : null;
  }
  const normalized = normalizeAnchor(value);
  return normalized ? { kind: "heading", value, normalized } : null;
}

function isBlockId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(value);
}

function normalizeBlockId(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeAlias(value: string): string {
  return stripExtension(value).trim().toLocaleLowerCase();
}

function normalizedBasename(path: string): string {
  return normalizeAlias(path.split("/").at(-1) ?? path);
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  return [];
}

function stripExtension(path: string): string {
  return path.replace(/\.[^./]+$/i, "");
}

function hasFileExtension(path: string): boolean {
  return /\.[^/]+$/.test(path);
}

function decodeComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
    if (part.includes("\\") || hasControlCharacters(part)) return null;
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("/") : null;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
