import { randomUUID } from "node:crypto";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { parseDocument } from "yaml";

import type { VaultFile } from "../vault-adapter/types.js";
import { assertScanLimits, DEFAULT_SCAN_LIMITS, type ScanLimits } from "./limits.js";

export type ReferenceKind = "wiki" | "embed" | "markdown";

export type ParsedReference = {
  kind: ReferenceKind;
  rawTarget: string;
  locator: string;
  excerpt: string;
};

export type ScannedNote = {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  revision: string;
  headings: string[];
  blockIds: string[];
  references: ParsedReference[];
};

export type ScanSnapshot = {
  id: string;
  notes: readonly ScannedNote[];
};

const markdownReference = /!?\[[^\]]*\]\(([^)]+)\)/g;
const wikiReference = /(!)?\[\[([^\]]+)\]\]/g;

export function scanVaultFiles(
  files: readonly VaultFile[],
  reusableNotes: ReadonlyMap<string, ScannedNote> = new Map(),
  limits: ScanLimits = DEFAULT_SCAN_LIMITS
): ScanSnapshot {
  assertScanLimits(files, limits);
  const paths = new Set<string>();
  const notes = files.map((file, index) => {
    const path = normalizeVaultPath(file.path);
    if (!isSafeVaultPath(path) || paths.has(path))
      throw new Error("vault path is unsafe or ambiguous");
    paths.add(path);
    const revision = file.revision ?? `memory-${index}`;
    const cached = reusableNotes.get(path);
    return cached?.revision === revision ? cached : scanFile(file, index, limits);
  });
  return { id: `scan-${randomUUID()}`, notes };
}

function scanFile(file: VaultFile, index: number, limits: ScanLimits): ScannedNote {
  const parsed = parseSafeFrontmatter(file.content);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(parsed.content);
  const headings = tree.children.flatMap((node) => {
    if (node.type !== "heading") return [];
    return [node.children.map((child) => ("value" in child ? child.value : "")).join("")];
  });
  if (headings.length > limits.maxHeadingsPerFile)
    throw new Error("vault exceeds configured processing limits");
  const blockIds = extractBlockIds(parsed.content);
  if (headings.length + blockIds.length > limits.maxHeadingsPerFile)
    throw new Error("vault exceeds configured processing limits");
  const references = extractReferences(parsed.content);
  if (references.length > limits.maxReferencesPerFile)
    throw new Error("vault exceeds configured processing limits");

  return {
    path: normalizeVaultPath(file.path),
    content: parsed.content,
    frontmatter: parsed.data,
    revision: file.revision ?? `memory-${index}`,
    headings,
    blockIds,
    references
  };
}

function parseSafeFrontmatter(content: string): {
  data: Record<string, unknown>;
  content: string;
} {
  if (/^---[^\r\n]*[^\r\n-][^\r\n]*\r?\n/.test(content))
    throw new Error("frontmatter must use a YAML delimiter without a language engine");
  const opening = /^---\r?\n/.exec(content);
  if (!opening) return { data: {}, content };
  const afterOpening = content.slice(opening[0].length);
  const closing = /(?:^|\r?\n)---(?:\r?\n|$)/.exec(afterOpening);
  if (!closing) return { data: {}, content };
  const header = afterOpening.slice(0, closing.index);
  if (
    new TextEncoder().encode(header).byteLength > 32_768 ||
    /(^|\n)\s*(?:<<\s*:|[^#\n]+:\s*[*&])/.test(header)
  )
    throw new Error("frontmatter exceeds safe parser limits");
  let depth = 0;
  for (const line of header.split("\n")) {
    if (/\S/.test(line)) depth = Math.max(depth, Math.floor(line.match(/^\s*/)![0].length / 2) + 1);
    if (depth > 64) throw new Error("frontmatter exceeds safe parser limits");
  }
  const document = parseDocument(header, { uniqueKeys: true });
  if (document.errors.length > 0) throw new Error("frontmatter is invalid YAML");
  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch {
    throw new Error("frontmatter exceeds safe parser limits");
  }
  if (value === null)
    return { data: {}, content: afterOpening.slice(closing.index + closing[0].length) };
  if (Array.isArray(value) || typeof value !== "object")
    throw new Error("frontmatter must be a YAML mapping");
  return {
    data: value as Record<string, unknown>,
    content: afterOpening.slice(closing.index + closing[0].length)
  };
}

function extractBlockIds(content: string): string[] {
  const blockIds: string[] = [];
  let fence: string | undefined;
  for (const line of content.split("\n")) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]![0]!;
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence || /^(?: {4}|\t)/.test(line)) continue;
    const match = /(?:^|\s)\^([A-Za-z0-9][A-Za-z0-9-]{0,127})\s*$/.exec(line);
    if (match?.[1]) blockIds.push(match[1]);
  }
  return blockIds;
}

function extractReferences(content: string): ParsedReference[] {
  const references: Array<ParsedReference & { offset: number }> = [];

  for (const match of content.matchAll(wikiReference)) {
    const rawTarget = match[2]?.split("|")[0]?.trim() ?? "";
    references.push({
      kind: match[1] === "!" ? "embed" : "wiki",
      rawTarget,
      locator: lineLocator(content, match.index ?? 0),
      excerpt: match[0],
      offset: match.index ?? 0
    });
  }

  for (const match of content.matchAll(markdownReference)) {
    references.push({
      kind: "markdown",
      rawTarget: match[1]?.trim() ?? "",
      locator: lineLocator(content, match.index ?? 0),
      excerpt: match[0],
      offset: match.index ?? 0
    });
  }

  return references
    .sort((left, right) => left.offset - right.offset)
    .map(({ kind, rawTarget, locator, excerpt }) => ({ kind, rawTarget, locator, excerpt }));
}

function lineLocator(content: string, offset: number): string {
  const before = content.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n");
  return `line:${line}:column:${column}`;
}

export function normalizeVaultPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isSafeVaultPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !hasControlCharacters(path) &&
    !path.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function normalizeAnchor(anchor: string): string {
  return anchor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}
