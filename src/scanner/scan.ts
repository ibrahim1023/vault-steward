import matter from "gray-matter";
import { randomUUID } from "node:crypto";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

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
  const parsed = matter(file.content);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(parsed.content);
  const headings = tree.children.flatMap((node) => {
    if (node.type !== "heading") return [];
    return [node.children.map((child) => ("value" in child ? child.value : "")).join("")];
  });
  if (headings.length > limits.maxHeadingsPerFile)
    throw new Error("vault exceeds configured processing limits");
  const references = extractReferences(parsed.content);
  if (references.length > limits.maxReferencesPerFile)
    throw new Error("vault exceeds configured processing limits");

  return {
    path: normalizeVaultPath(file.path),
    content: parsed.content,
    frontmatter: parsed.data as Record<string, unknown>,
    revision: file.revision ?? `memory-${index}`,
    headings,
    references
  };
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
  return `line:${content.slice(0, offset).split("\n").length}`;
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
