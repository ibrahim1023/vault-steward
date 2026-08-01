import { createHash } from "node:crypto";

import type { EntityCanonicalIntent, Finding } from "../contracts/index.js";
import {
  calculatePreparedRepairOutcome,
  type PreparedRepairBatch
} from "../contracts/prepared-repair.js";
import type { Proposal, ReplaceRangeOperation } from "../contracts/proposal.js";
import { replaceInternalReference } from "./propose.js";
import type { ScanSnapshot, ScannedNote } from "../scanner/scan.js";
import { resolveInternalReference } from "../reference/resolve.js";
import { buildEntityCanonicalCandidates } from "./entity-canonical-recommendation.js";
import { buildDuplicateEntityReview } from "./entity-duplicate-review.js";
import type { PreparedRepair, PreparedRepairItem } from "./prepare-repair-batch.js";

export type EntityConsolidationSource = { path: string; revision: string; content: string };

const MAX_OPERATIONS = 20;

export async function prepareEntityConsolidation(input: {
  snapshot: ScanSnapshot;
  finding: Finding;
  intent: EntityCanonicalIntent;
  activeFindingCount: number;
  readSource: (path: string) => Promise<Omit<EntityConsolidationSource, "path">>;
  persistProposal: (proposal: Proposal) => void | Promise<void>;
}): Promise<PreparedRepair | null> {
  const review = buildDuplicateEntityReview(input.snapshot, input.finding);
  if (!review || !validIntent(input.intent, input.finding, input.snapshot.id)) return null;
  const candidates = buildEntityCanonicalCandidates(review);
  const canonicalCandidate = candidates.find(
    (candidate) => candidate.id === input.intent.candidateId
  );
  if (!canonicalCandidate) return null;
  const canonical = input.snapshot.notes.find((note) => note.path === canonicalCandidate.path);
  const duplicate = input.snapshot.notes.find(
    (note) =>
      note.path !== canonicalCandidate.path && review.notes.some((item) => item.path === note.path)
  );
  if (!canonical || !duplicate) return null;

  const involved = new Map<string, EntityConsolidationSource>();
  const read = async (note: ScannedNote): Promise<EntityConsolidationSource | null> => {
    const cached = involved.get(note.path);
    if (cached) return cached;
    try {
      const source = { path: note.path, ...(await input.readSource(note.path)) };
      if (source.revision !== note.revision) return null;
      involved.set(note.path, source);
      return source;
    } catch {
      return null;
    }
  };

  const operations: ReplaceRangeOperation[] = [];
  const items: PreparedRepairItem[] = [];
  for (const sourceNote of input.snapshot.notes) {
    if (sourceNote.path === canonical.path || sourceNote.path === duplicate.path) continue;
    const source = await read(sourceNote);
    if (!source) return null;
    for (const reference of sourceNote.references) {
      if (operations.length >= MAX_OPERATIONS) break;
      const resolution = resolveInternalReference(input.snapshot, reference, sourceNote.path);
      if (resolution.status !== "resolved" || resolution.canonicalPath !== duplicate.path) continue;
      const replacement = replaceInternalReference(
        reference.excerpt,
        sourceNote.path,
        canonical.path
      );
      if (!replacement || replacement === reference.excerpt) continue;
      const operation = referenceOperation(
        source,
        sourceNote,
        reference.excerpt,
        replacement,
        reference.locator
      );
      if (!operation || operationOverlaps(operations, operation)) continue;
      operations.push(operation);
      items.push(
        referenceItem(input.finding, operation, reference.locator, canonical.path, [
          canonical.path,
          duplicate.path
        ])
      );
    }
  }

  if (operations.length < MAX_OPERATIONS) {
    const canonicalSource = await read(canonical);
    const duplicateSource = await read(duplicate);
    if (!canonicalSource || !duplicateSource) return null;
    const aliasOperations = transferExclusiveAliases(
      input.snapshot,
      canonical,
      duplicate,
      canonicalSource,
      duplicateSource
    );
    for (const operation of aliasOperations) {
      if (operations.length >= MAX_OPERATIONS || operationOverlaps(operations, operation)) break;
      operations.push(operation);
      items.push({
        proposalId: "",
        findingId: input.finding.id,
        sourcePath: operation.path,
        locator: "frontmatter:aliases",
        currentReference: operation.expected,
        replacementReference: operation.replacement || "(remove alias field)",
        repairFamily: "entity",
        repairKind: "transfer-alias",
        targetPath: canonical.path,
        targetExists: true,
        targetStatus: "ai-suggested",
        affectedNotes: [canonical.path, duplicate.path]
      });
    }
  }
  if (operations.length === 0) return null;

  const proposal: Proposal = {
    schemaVersion: 1,
    id: `proposal:${input.finding.id}:consolidate:${shortHash(canonical.path)}`,
    findingId: input.finding.id,
    scanId: input.snapshot.id,
    explanation:
      "Normalize references to the user-selected canonical note and transfer only exclusive aliases.",
    operations: operations.sort(
      (left, right) => left.path.localeCompare(right.path) || left.start - right.start
    )
  };
  for (const item of items) item.proposalId = proposal.id;
  await input.persistProposal(proposal);
  const batch: PreparedRepairBatch = {
    schemaVersion: 1,
    id: `batch:${input.snapshot.id}:${shortHash([proposal.id])}`,
    scanId: input.snapshot.id,
    proposalIds: [proposal.id],
    findingIds: [input.finding.id],
    // Duplicate re-evaluation is semantic, so the post-apply scan, not this plan, decides resolution.
    outcome: calculatePreparedRepairOutcome([proposal], input.activeFindingCount, 0)
  };
  return { batch, proposals: [proposal], items };
}

function validIntent(intent: EntityCanonicalIntent, finding: Finding, scanId: string): boolean {
  return (
    intent.schemaVersion === 1 &&
    intent.kind === "select-canonical" &&
    intent.scanId === scanId &&
    intent.scanId === finding.scanId &&
    intent.findingId === finding.id &&
    intent.candidateId.length > 0 &&
    intent.candidateId.length <= 512
  );
}

function referenceOperation(
  source: EntityConsolidationSource,
  note: ScannedNote,
  expected: string,
  replacement: string,
  locator: string
): ReplaceRangeOperation | null {
  const bodyStart = source.content.indexOf(note.content);
  const line = Number(/^line:(\d+)$/.exec(locator)?.[1]);
  if (bodyStart < 0 || !Number.isSafeInteger(line) || line < 1) return null;
  const lines = note.content.split("\n");
  const prefix = lines.slice(0, line - 1).join("\n");
  const startAt = bodyStart + prefix.length + (line > 1 ? 1 : 0);
  const start = source.content.indexOf(expected, startAt);
  if (start < startAt || source.content.slice(start, start + expected.length) !== expected)
    return null;
  return {
    kind: "replace-range",
    path: source.path,
    sourceRevision: source.revision,
    start,
    end: start + expected.length,
    expected,
    replacement
  };
}

function transferExclusiveAliases(
  snapshot: ScanSnapshot,
  canonical: ScannedNote,
  duplicate: ScannedNote,
  canonicalSource: EntityConsolidationSource,
  duplicateSource: EntityConsolidationSource
): ReplaceRangeOperation[] {
  const canonicalAliases = aliases(canonical);
  const transferable = aliases(duplicate).filter(
    (alias) =>
      !canonicalAliases.some((other) => same(alias, other)) &&
      !snapshot.notes.some(
        (note) =>
          note.path !== canonical.path &&
          note.path !== duplicate.path &&
          aliases(note).some((other) => same(alias, other))
      )
  );
  if (transferable.length === 0) return [];
  const nextCanonical = [...canonicalAliases, ...transferable].sort((left, right) =>
    left.localeCompare(right)
  );
  const nextDuplicate = aliases(duplicate).filter(
    (alias) => !transferable.some((moved) => same(alias, moved))
  );
  const canonicalOperation = aliasOperation(canonicalSource, nextCanonical);
  const duplicateOperation = aliasOperation(duplicateSource, nextDuplicate);
  return canonicalOperation && duplicateOperation ? [canonicalOperation, duplicateOperation] : [];
}

function aliasOperation(
  source: EntityConsolidationSource,
  aliases: readonly string[]
): ReplaceRangeOperation | null {
  if (!source.content.startsWith("---\n")) return null;
  const closing = source.content.indexOf("\n---\n", 4);
  if (closing < 0) return null;
  const header = source.content.slice(4, closing);
  const match = /^aliases:[^\n]*\n?/m.exec(header);
  if (!match) return null;
  const expected = match[0]!;
  const replacement = aliases.length > 0 ? `aliases: ${JSON.stringify(aliases)}\n` : "";
  return {
    kind: "replace-range",
    path: source.path,
    sourceRevision: source.revision,
    start: 4 + match.index,
    end: 4 + match.index + expected.length,
    expected,
    replacement
  };
}

function aliases(note: ScannedNote): string[] {
  const value = note.frontmatter.aliases;
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return values
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function referenceItem(
  finding: Finding,
  operation: ReplaceRangeOperation,
  locator: string,
  canonicalPath: string,
  affectedNotes: string[]
): PreparedRepairItem {
  return {
    proposalId: "",
    findingId: finding.id,
    sourcePath: operation.path,
    locator,
    currentReference: operation.expected,
    replacementReference: operation.replacement,
    repairFamily: "entity",
    repairKind: "normalize-reference",
    targetPath: canonicalPath,
    targetExists: true,
    targetStatus: "ai-suggested",
    affectedNotes
  };
}

function operationOverlaps(
  existing: readonly ReplaceRangeOperation[],
  candidate: ReplaceRangeOperation
): boolean {
  return existing.some(
    (operation) =>
      operation.path === candidate.path &&
      operation.start < candidate.end &&
      candidate.start < operation.end
  );
}

function same(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function shortHash(value: string | readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
