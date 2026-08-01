export type EntityCanonicalIntent = {
  schemaVersion: 1;
  kind: "select-canonical";
  scanId: string;
  findingId: string;
  candidateId: string;
};

export type EntityCanonicalIntentParseResult =
  { ok: true; value: EntityCanonicalIntent } | { ok: false; diagnostics: string[] };

export function parseEntityCanonicalIntent(value: unknown): EntityCanonicalIntentParseResult {
  if (!isRecord(value)) return invalid("entity canonical intent must be an object");
  const diagnostics = Object.keys(value)
    .filter((key) => !["schemaVersion", "kind", "scanId", "findingId", "candidateId"].includes(key))
    .map((key) => `entity canonical intent has unknown field '${key}'`);
  if (value.schemaVersion !== 1)
    diagnostics.push("entity canonical intent schemaVersion must be 1");
  if (value.kind !== "select-canonical")
    diagnostics.push("entity canonical intent kind is unsupported");
  for (const field of ["scanId", "findingId", "candidateId"] as const) {
    if (!isBoundedString(value[field]))
      diagnostics.push(`entity canonical intent ${field} must be a bounded non-empty string`);
  }
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          kind: "select-canonical",
          scanId: value.scanId as string,
          findingId: value.findingId as string,
          candidateId: value.candidateId as string
        }
      };
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(diagnostic: string): EntityCanonicalIntentParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}
