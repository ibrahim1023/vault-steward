import type { Finding } from "../contracts/index.js";
import { resolveInternalReference } from "../reference/resolve.js";
import type { ScanSnapshot, ScannedNote } from "../scanner/scan.js";

export type DuplicateEntityNote = {
  path: string;
  title: string;
  aliases: string[];
  backlinks: Array<{ sourcePath: string; locator: string; excerpt: string }>;
};

export type MetadataConflict = {
  field: string;
  left: string;
  right: string;
};

export type DuplicateEntityReview = {
  schemaVersion: 1;
  scanId: string;
  findingId: string;
  notes: [DuplicateEntityNote, DuplicateEntityNote];
  citedEvidence: [Finding["evidence"][number], Finding["evidence"][number]];
  sharedAliases: string[];
  conflictingMetadata: MetadataConflict[];
};

const SENSITIVE_FIELD = /(api.?key|credential|password|secret|token)/i;
const MAX_METADATA_FIELDS = 16;
const MAX_BACKLINKS = 50;

export function buildDuplicateEntityReview(
  snapshot: ScanSnapshot,
  finding: Finding
): DuplicateEntityReview | null {
  if (
    finding.type !== "entity-alias" ||
    finding.scanId !== snapshot.id ||
    finding.evidence.length !== 2
  )
    return null;
  const [leftEvidence, rightEvidence] = finding.evidence;
  if (!leftEvidence || !rightEvidence || leftEvidence.notePath === rightEvidence.notePath)
    return null;
  const left = snapshot.notes.find((note) => note.path === leftEvidence.notePath);
  const right = snapshot.notes.find((note) => note.path === rightEvidence.notePath);
  if (!left || !right) return null;

  const leftAliases = aliases(left);
  const rightAliases = aliases(right);
  return {
    schemaVersion: 1,
    scanId: snapshot.id,
    findingId: finding.id,
    notes: [toReviewNote(snapshot, left, leftAliases), toReviewNote(snapshot, right, rightAliases)],
    citedEvidence: [leftEvidence, rightEvidence],
    sharedAliases: leftAliases.filter((alias) => rightAliases.some((other) => same(alias, other))),
    conflictingMetadata: metadataConflicts(left, right)
  };
}

function toReviewNote(
  snapshot: ScanSnapshot,
  note: ScannedNote,
  noteAliases: string[]
): DuplicateEntityNote {
  return {
    path: note.path,
    title: noteTitle(note),
    aliases: noteAliases,
    backlinks: snapshot.notes
      .flatMap((source) =>
        source.references.flatMap((reference) => {
          const resolution = resolveInternalReference(snapshot, reference, source.path);
          return resolution.status === "resolved" && resolution.canonicalPath === note.path
            ? [{ sourcePath: source.path, locator: reference.locator, excerpt: reference.excerpt }]
            : [];
        })
      )
      .slice(0, MAX_BACKLINKS)
  };
}

function noteTitle(note: ScannedNote): string {
  if (typeof note.frontmatter.title === "string" && note.frontmatter.title.trim().length > 0)
    return note.frontmatter.title.trim();
  return note.headings[0]?.trim() || note.path.replace(/\.md$/i, "").split("/").at(-1) || note.path;
}

function aliases(note: ScannedNote): string[] {
  const value = note.frontmatter.aliases;
  const entries = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return [
    ...new Set(
      entries.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      )
    )
  ]
    .map((entry) => entry.trim())
    .sort((left, right) => left.localeCompare(right));
}

function metadataConflicts(left: ScannedNote, right: ScannedNote): MetadataConflict[] {
  const fields = [...new Set([...Object.keys(left.frontmatter), ...Object.keys(right.frontmatter)])]
    .filter((field) => field !== "aliases" && field !== "title" && !SENSITIVE_FIELD.test(field))
    .sort((first, second) => first.localeCompare(second));
  return fields
    .flatMap((field) => {
      const leftValue = renderMetadata(left.frontmatter[field]);
      const rightValue = renderMetadata(right.frontmatter[field]);
      return leftValue !== null && rightValue !== null && leftValue !== rightValue
        ? [{ field, left: leftValue, right: rightValue }]
        : [];
    })
    .slice(0, MAX_METADATA_FIELDS);
}

function renderMetadata(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const rendered = String(value);
    return rendered.length <= 300 ? rendered : null;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    const rendered = value.join(", ");
    return rendered.length <= 300 ? rendered : null;
  }
  return null;
}

function same(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
