export const REFERENCE_REPAIR_KINDS = [
  "retarget-note",
  "replace-heading-anchor",
  "replace-block-anchor",
  "normalize-reference"
] as const;

export type ReferenceRepairKind = (typeof REFERENCE_REPAIR_KINDS)[number];
export type ReferenceRepairProvenance = "verified-rename" | "ai-suggested" | "verified-canonical";

export type ReferenceRepairIntent = {
  schemaVersion: 1;
  kind: ReferenceRepairKind;
  scanId: string;
  findingId: string;
  targetPath: string;
  provenance: ReferenceRepairProvenance;
  anchor?: {
    kind: "heading" | "block";
    value: string;
    candidateId: string;
  };
};

export type ReferenceRepairIntentParseResult =
  { ok: true; value: ReferenceRepairIntent } | { ok: false; diagnostics: string[] };

export function parseReferenceRepairIntent(value: unknown): ReferenceRepairIntentParseResult {
  if (!isRecord(value)) return invalid("reference repair intent must be an object");
  const diagnostics = unknownFields(value, [
    "schemaVersion",
    "kind",
    "scanId",
    "findingId",
    "targetPath",
    "provenance",
    "anchor"
  ]);
  if (value.schemaVersion !== 1) diagnostics.push("intent schemaVersion must be 1");
  if (!REFERENCE_REPAIR_KINDS.includes(value.kind as ReferenceRepairKind))
    diagnostics.push("intent kind is unsupported");
  for (const field of ["scanId", "findingId"] as const) {
    if (!isBoundedString(value[field], 512))
      diagnostics.push(`intent ${field} must be a bounded non-empty string`);
  }
  if (!isVaultMarkdownPath(value.targetPath))
    diagnostics.push("intent targetPath must be a safe vault Markdown path");
  if (!["verified-rename", "ai-suggested", "verified-canonical"].includes(String(value.provenance)))
    diagnostics.push("intent provenance is unsupported");

  const anchor = parseAnchor(value.anchor, diagnostics);
  const kind = value.kind as ReferenceRepairKind;
  if (["replace-heading-anchor", "replace-block-anchor"].includes(kind) && anchor === undefined)
    diagnostics.push("anchor repair intent requires an anchor candidate");
  if (
    !["replace-heading-anchor", "replace-block-anchor"].includes(kind) &&
    value.anchor !== undefined
  )
    diagnostics.push("non-anchor intent cannot include an anchor candidate");
  if (
    anchor &&
    ((kind === "replace-heading-anchor" && anchor.kind !== "heading") ||
      (kind === "replace-block-anchor" && anchor.kind !== "block"))
  )
    diagnostics.push("intent kind and anchor kind must agree");

  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          kind,
          scanId: value.scanId as string,
          findingId: value.findingId as string,
          targetPath: value.targetPath as string,
          provenance: value.provenance as ReferenceRepairProvenance,
          ...(anchor ? { anchor } : {})
        }
      };
}

function parseAnchor(
  value: unknown,
  diagnostics: string[]
): ReferenceRepairIntent["anchor"] | undefined {
  if (value === undefined) return undefined;
  const initialDiagnosticCount = diagnostics.length;
  if (!isRecord(value)) {
    diagnostics.push("intent anchor must be an object");
    return undefined;
  }
  diagnostics.push(...unknownFields(value, ["kind", "value", "candidateId"], "intent anchor"));
  if (!["heading", "block"].includes(String(value.kind)))
    diagnostics.push("intent anchor kind is unsupported");
  if (!isBoundedString(value.value, 512)) diagnostics.push("intent anchor value is invalid");
  if (!isBoundedString(value.candidateId, 512))
    diagnostics.push("intent anchor candidateId is invalid");
  return diagnostics.length === initialDiagnosticCount
    ? {
        kind: value.kind as "heading" | "block",
        value: value.value as string,
        candidateId: value.candidateId as string
      }
    : undefined;
}

function isVaultMarkdownPath(value: unknown): value is string {
  return (
    isBoundedString(value, 2_048) &&
    value.endsWith(".md") &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").some((part) => !part || part === "." || part === "..") &&
    !hasControlCharacters(value)
  );
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function unknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label = "intent"
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${label} has unknown field '${key}'`);
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(diagnostic: string): ReferenceRepairIntentParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}
