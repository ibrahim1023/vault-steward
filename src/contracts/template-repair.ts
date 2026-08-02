export type TemplateRepairIntent = {
  schemaVersion: 1;
  kind: "set-frontmatter";
  scanId: string;
  findingId: string;
  templateId: string;
  field: string;
  candidateId: string;
};

export function parseTemplateRepairIntent(
  value: unknown
): { ok: true; value: TemplateRepairIntent } | { ok: false; diagnostics: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, diagnostics: ["template repair intent must be an object"] };
  const candidate = value as Record<string, unknown>;
  const fields = [
    "schemaVersion",
    "kind",
    "scanId",
    "findingId",
    "templateId",
    "field",
    "candidateId"
  ];
  const diagnostics = Object.keys(candidate)
    .filter((field) => !fields.includes(field))
    .map((field) => `intent has unknown field '${field}'`);
  if (candidate.schemaVersion !== 1) diagnostics.push("intent schemaVersion must be 1");
  if (candidate.kind !== "set-frontmatter") diagnostics.push("template repair kind is unsupported");
  for (const field of fields.slice(2)) {
    const item = candidate[field];
    if (typeof item !== "string" || item.length === 0 || item.length > 512 || /[\r\n\0]/.test(item))
      diagnostics.push(`intent ${field} is invalid`);
  }
  return diagnostics.length
    ? { ok: false, diagnostics }
    : {
        ok: true,
        value: {
          schemaVersion: 1,
          kind: "set-frontmatter",
          scanId: candidate.scanId as string,
          findingId: candidate.findingId as string,
          templateId: candidate.templateId as string,
          field: candidate.field as string,
          candidateId: candidate.candidateId as string
        }
      };
}
