import type { Proposal } from "./proposal.js";

const MAX_BATCH_ITEMS = 20;
const MAX_OUTCOME_COUNT = 1_000_000;

export type PreparedRepairOutcome = {
  expectedFindingsResolved: number;
  notesEdited: number;
  notesCreated: 0;
  notesDeleted: 0;
  findingsLeftUnchanged: number;
};

export type PreparedRepairBatch = {
  schemaVersion: 1;
  id: string;
  scanId: string;
  proposalIds: string[];
  findingIds: string[];
  outcome: PreparedRepairOutcome;
};

export type PreparedRepairBatchParseResult =
  { ok: true; value: PreparedRepairBatch } | { ok: false; diagnostics: string[] };

export function parsePreparedRepairBatch(value: unknown): PreparedRepairBatchParseResult {
  if (!isRecord(value)) return invalid("prepared repair batch must be an object");

  const diagnostics = unknownFields(
    value,
    ["schemaVersion", "id", "scanId", "proposalIds", "findingIds", "outcome"],
    "prepared repair batch"
  );
  if (value.schemaVersion !== 1) diagnostics.push("prepared repair batch schemaVersion must be 1");
  if (!isNonEmptyString(value.id))
    diagnostics.push("prepared repair batch id must be a non-empty string");
  if (!isNonEmptyString(value.scanId))
    diagnostics.push("prepared repair batch scanId must be a non-empty string");

  const proposalIds = parseIds(value.proposalIds, "proposalIds", diagnostics);
  const findingIds = parseIds(value.findingIds, "findingIds", diagnostics);
  if (proposalIds.length !== findingIds.length)
    diagnostics.push("prepared repair batch proposalIds and findingIds must have equal lengths");

  const outcome = parseOutcome(value.outcome, proposalIds.length, diagnostics);
  return diagnostics.length > 0 || !outcome
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          id: value.id as string,
          scanId: value.scanId as string,
          proposalIds,
          findingIds,
          outcome
        }
      };
}

export function calculatePreparedRepairOutcome(
  proposals: readonly Proposal[],
  activeFindingCount: number
): PreparedRepairOutcome {
  if (proposals.length === 0 || proposals.length > MAX_BATCH_ITEMS)
    throw new Error(`prepared repair batch must contain 1-${MAX_BATCH_ITEMS} proposals`);
  if (!isCount(activeFindingCount))
    throw new Error("active finding count must be a bounded non-negative integer");

  const scanIds = new Set(proposals.map((proposal) => proposal.scanId));
  if (scanIds.size !== 1) throw new Error("prepared repair proposals must belong to the same scan");

  const proposalIds = new Set(proposals.map((proposal) => proposal.id));
  const findingIds = new Set(proposals.map((proposal) => proposal.findingId));
  if (proposalIds.size !== proposals.length)
    throw new Error("prepared repair proposal IDs must be unique");
  if (findingIds.size !== proposals.length)
    throw new Error("prepared repair finding IDs must be unique");
  if (activeFindingCount < findingIds.size)
    throw new Error("active finding count cannot be lower than selected findings");

  const notePaths = new Set(
    proposals.flatMap((proposal) => proposal.operations.map((operation) => operation.path))
  );
  return {
    expectedFindingsResolved: findingIds.size,
    notesEdited: notePaths.size,
    notesCreated: 0,
    notesDeleted: 0,
    findingsLeftUnchanged: activeFindingCount - findingIds.size
  };
}

function parseIds(value: unknown, label: string, diagnostics: string[]): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_ITEMS) {
    diagnostics.push(`${label} must contain 1-${MAX_BATCH_ITEMS} IDs`);
    return [];
  }
  if (!value.every(isNonEmptyString)) {
    diagnostics.push(`${label} must contain only non-empty strings`);
    return [];
  }
  const ids = value as string[];
  if (new Set(ids).size !== ids.length) diagnostics.push(`${label} must contain unique IDs`);
  return [...ids];
}

function parseOutcome(
  value: unknown,
  selectedCount: number,
  diagnostics: string[]
): PreparedRepairOutcome | null {
  if (!isRecord(value)) {
    diagnostics.push("prepared repair outcome must be an object");
    return null;
  }
  diagnostics.push(
    ...unknownFields(
      value,
      [
        "expectedFindingsResolved",
        "notesEdited",
        "notesCreated",
        "notesDeleted",
        "findingsLeftUnchanged"
      ],
      "prepared repair outcome"
    )
  );
  for (const field of [
    "expectedFindingsResolved",
    "notesEdited",
    "findingsLeftUnchanged"
  ] as const) {
    if (!isCount(value[field]))
      diagnostics.push(`prepared repair outcome ${field} must be a bounded non-negative integer`);
  }
  if (value.notesCreated !== 0 || value.notesDeleted !== 0)
    diagnostics.push("prepared repair batches cannot create or delete notes");
  if (value.expectedFindingsResolved !== selectedCount)
    diagnostics.push("expected findings resolved must match the selected finding count");
  if (typeof value.notesEdited === "number" && value.notesEdited > selectedCount)
    diagnostics.push("notes edited cannot exceed the selected proposal count");

  return diagnostics.length > 0
    ? null
    : {
        expectedFindingsResolved: value.expectedFindingsResolved as number,
        notesEdited: value.notesEdited as number,
        notesCreated: 0,
        notesDeleted: 0,
        findingsLeftUnchanged: value.findingsLeftUnchanged as number
      };
}

function unknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${label} has unknown field '${key}'`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512;
}

function isCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_OUTCOME_COUNT
  );
}

function invalid(diagnostic: string): PreparedRepairBatchParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}
