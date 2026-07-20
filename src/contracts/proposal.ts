export type ReplaceRangeOperation = {
  kind: "replace-range";
  path: string;
  sourceRevision: string;
  start: number;
  end: number;
  expected: string;
  replacement: string;
};

export type Proposal = {
  schemaVersion: 1;
  id: string;
  findingId: string;
  scanId: string;
  explanation: string;
  operations: ReplaceRangeOperation[];
};

export type ProposalParseResult =
  { ok: true; value: Proposal } | { ok: false; diagnostics: string[] };

export function parseProposal(value: unknown): ProposalParseResult {
  if (!isRecord(value)) return invalid("proposal must be an object");
  const diagnostics = unknownFields(
    value,
    ["schemaVersion", "id", "findingId", "scanId", "explanation", "operations"],
    "proposal"
  );
  if (value.schemaVersion !== 1) diagnostics.push("proposal schemaVersion must be 1");
  for (const field of ["id", "findingId", "scanId", "explanation"] as const) {
    if (!isNonEmptyString(value[field]))
      diagnostics.push(`proposal ${field} must be a non-empty string`);
  }
  if (!Array.isArray(value.operations) || value.operations.length === 0) {
    diagnostics.push("proposal operations must be a non-empty array");
    return { ok: false, diagnostics };
  }
  const operations = value.operations.flatMap((operation, index) =>
    parseOperation(operation, index, diagnostics)
  );
  diagnostics.push(...overlapDiagnostics(operations));
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          id: value.id as string,
          findingId: value.findingId as string,
          scanId: value.scanId as string,
          explanation: value.explanation as string,
          operations
        }
      };
}

export function proposalDigest(proposal: Proposal): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: proposal.schemaVersion,
        id: proposal.id,
        findingId: proposal.findingId,
        scanId: proposal.scanId,
        explanation: proposal.explanation,
        operations: proposal.operations.map((operation) => ({
          kind: operation.kind,
          path: operation.path,
          sourceRevision: operation.sourceRevision,
          start: operation.start,
          end: operation.end,
          expected: operation.expected,
          replacement: operation.replacement
        }))
      })
    )
    .digest("hex");
}

function overlapDiagnostics(operations: readonly ReplaceRangeOperation[]): string[] {
  const byPath = new Map<string, ReplaceRangeOperation[]>();
  for (const operation of operations)
    byPath.set(operation.path, [...(byPath.get(operation.path) ?? []), operation]);
  return [...byPath.values()].flatMap((items) => {
    const sorted = [...items].sort(
      (left, right) => left.start - right.start || left.end - right.end
    );
    return sorted
      .slice(1)
      .flatMap((operation, index) =>
        operation.start < sorted[index]!.end
          ? [`operations for ${operation.path} must not overlap`]
          : []
      );
  });
}

function parseOperation(
  value: unknown,
  index: number,
  diagnostics: string[]
): ReplaceRangeOperation[] {
  if (!isRecord(value)) {
    diagnostics.push(`operation ${index} must be an object`);
    return [];
  }
  diagnostics.push(
    ...unknownFields(
      value,
      ["kind", "path", "sourceRevision", "start", "end", "expected", "replacement"],
      `operation ${index}`
    )
  );
  if (value.kind !== "replace-range") {
    diagnostics.push(`operation ${index} has an unknown kind`);
    return [];
  }
  if (!isVaultPath(value.path))
    diagnostics.push(`operation ${index} path must stay inside the vault`);
  if (!isNonEmptyString(value.sourceRevision))
    diagnostics.push(`operation ${index} sourceRevision must be a non-empty string`);
  const start = value.start;
  const end = value.end;
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start
  )
    diagnostics.push(`operation ${index} has an invalid range`);
  if (!isNonEmptyString(value.expected))
    diagnostics.push(`operation ${index} expected text must be non-empty`);
  if (typeof value.replacement !== "string")
    diagnostics.push(`operation ${index} replacement must be a string`);
  return diagnostics.length === 0
    ? [
        {
          kind: "replace-range",
          path: value.path as string,
          sourceRevision: value.sourceRevision as string,
          start: value.start as number,
          end: value.end as number,
          expected: value.expected as string,
          replacement: value.replacement as string
        }
      ]
    : [];
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
  return typeof value === "string" && value.length > 0;
}
function isVaultPath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    value.endsWith(".md") &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").includes("..")
  );
}
function invalid(diagnostic: string): ProposalParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}
import { createHash } from "node:crypto";
