import matter from "gray-matter";
import { randomUUID } from "node:crypto";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

import type { VaultFile } from "../vault-adapter/types.js";

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
  reusableNotes: ReadonlyMap<string, ScannedNote> = new Map()
): ScanSnapshot {
  const notes = files.map((file, index) => {
    const path = normalizeVaultPath(file.path);
    const revision = file.revision ?? `memory-${index}`;
    const cached = reusableNotes.get(path);
    return cached?.revision === revision ? cached : scanFile(file, index);
  });
  return { id: `scan-${randomUUID()}`, notes };
}

function scanFile(file: VaultFile, index: number): ScannedNote {
  const parsed = matter(file.content);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(parsed.content);
  const headings = tree.children.flatMap((node) => {
    if (node.type !== "heading") return [];
    return [node.children.map((child) => ("value" in child ? child.value : "")).join("")];
  });

  return {
    path: normalizeVaultPath(file.path),
    content: parsed.content,
    frontmatter: parsed.data as Record<string, unknown>,
    revision: file.revision ?? `memory-${index}`,
    headings,
    references: extractReferences(parsed.content)
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

export function normalizeAnchor(anchor: string): string {
  return anchor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}
