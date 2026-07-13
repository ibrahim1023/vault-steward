export type SchemaDefinition = { required?: string[]; enums?: Record<string, readonly string[]> };
export type SchemaIssue = { field: string; message: string };

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
