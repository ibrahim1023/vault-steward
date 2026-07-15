export type SchemaDefinition = {
  template?: string;
  required?: string[];
  enums?: Record<string, readonly string[]>;
  types?: Record<string, "string" | "boolean" | "string[]">;
};
export type SchemaIssue = { field: string; message: string };
export type SchemaValidation = SchemaIssue & { locator: string };

export function checkFrontmatter(
  frontmatter: Record<string, unknown>,
  schema: SchemaDefinition
): SchemaIssue[] {
  const issues = (schema.required ?? []).flatMap((field) =>
    frontmatter[field] === undefined || frontmatter[field] === ""
      ? [{ field, message: `${field} is required` }]
      : []
  );
  for (const [field, values] of Object.entries(schema.enums ?? {})) {
    const value = frontmatter[field];
    if (value !== undefined && (typeof value !== "string" || !values.includes(value))) {
      issues.push({ field, message: `${field} must be one of the approved values` });
    }
  }
  return issues;
}

export function validateSchema(
  frontmatter: Record<string, unknown>,
  schemas: readonly SchemaDefinition[]
): SchemaValidation[] {
  const schema = schemas.find(
    (candidate) => !candidate.template || candidate.template === frontmatter.template
  );
  if (!schema) return [];
  const issues = checkFrontmatter(frontmatter, schema);
  for (const [field, type] of Object.entries(schema.types ?? {})) {
    const value = frontmatter[field];
    if (value !== undefined && !matchesType(value, type)) {
      issues.push({ field, message: `${field} must be a ${type}` });
    }
  }
  return issues.map((issue) => ({ ...issue, locator: `frontmatter:${issue.field}` }));
}

function matchesType(
  value: unknown,
  type: NonNullable<SchemaDefinition["types"]>[string]
): boolean {
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
