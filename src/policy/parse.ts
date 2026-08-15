import { parseDocument } from "yaml";
import { isPolicyTemplateId, type PolicyTemplateId } from "./templates.js";

export const MAX_POLICY_BYTES = 32_768;
const POLICY_FIELDS = new Set(["id", "version", "enabled", "templates", "rules"]);
const RULE_FIELDS = new Set(["id", "fact", "operator", "value", "severity"]);
const OPERATORS = new Set(["required", "equals", "not_equals", "forbidden"]);
const SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);

export type PolicyRule = {
  id: string;
  fact: string;
  operator: "required" | "equals" | "not_equals" | "forbidden";
  value?: string | boolean;
  severity: "info" | "low" | "medium" | "high" | "critical";
};

export type Policy = {
  id: string;
  version: 1;
  enabled: boolean;
  templates?: PolicyTemplateId[];
  rules: PolicyRule[];
};

export type PolicyParseResult = { ok: true; value: Policy } | { ok: false; diagnostics: string[] };

export function parsePolicy(source: string): PolicyParseResult {
  const sizeError = policySizeDiagnostic(source);
  if (sizeError) return { ok: false, diagnostics: [sizeError] };
  const safetyError = yamlSafetyDiagnostic(source);
  if (safetyError) return { ok: false, diagnostics: [safetyError] };

  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) {
    return { ok: false, diagnostics: document.errors.map((error) => error.message) };
  }
  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    return { ok: false, diagnostics: [error instanceof Error ? error.message : "invalid YAML"] };
  }
  if (!isRecord(value)) return invalid("policy must be a mapping");
  const diagnostics = [...unknownFields(value, POLICY_FIELDS, "policy"), ...validatePolicy(value)];
  return diagnostics.length > 0 ? { ok: false, diagnostics } : { ok: true, value: toPolicy(value) };
}

export function policySizeDiagnostic(source: string): string | null {
  return new TextEncoder().encode(source).byteLength > MAX_POLICY_BYTES
    ? `policy exceeds the ${MAX_POLICY_BYTES}-byte limit`
    : null;
}

function yamlSafetyDiagnostic(source: string): string | null {
  if (/(^|\n)\s*(?:<<\s*:|[^#\n]+:\s*[*&])/.test(source))
    return "policy aliases and merge keys are not supported";
  let maxDepth = 0;
  for (const line of source.split("\n")) {
    if (!/\S/.test(line)) continue;
    maxDepth = Math.max(maxDepth, Math.floor(line.match(/^\s*/)![0].length / 2) + 1);
  }
  return maxDepth > 64 ? "policy nesting exceeds the 64-level limit" : null;
}

function validatePolicy(value: Record<string, unknown>): string[] {
  const diagnostics: string[] = [];
  if (!isNonEmptyString(value.id)) diagnostics.push("policy id must be a non-empty string");
  if (value.version !== 1) diagnostics.push("policy version must be 1");
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") {
    diagnostics.push("policy enabled must be a boolean");
  }
  if (value.templates !== undefined) {
    if (!Array.isArray(value.templates) || !value.templates.every(isPolicyTemplateId)) {
      diagnostics.push("policy templates must contain only known template ids");
    } else if (new Set(value.templates).size !== value.templates.length) {
      diagnostics.push("policy templates must not contain duplicates");
    }
  }
  if (!Array.isArray(value.rules)) return [...diagnostics, "policy rules must be an array"];

  for (const [index, rule] of value.rules.entries()) {
    if (!isRecord(rule)) {
      diagnostics.push(`rule ${index} must be a mapping`);
      continue;
    }
    diagnostics.push(...unknownFields(rule, RULE_FIELDS, `rule ${index}`));
    if (!isNonEmptyString(rule.id)) diagnostics.push(`rule ${index} id must be a non-empty string`);
    if (!isNonEmptyString(rule.fact))
      diagnostics.push(`rule ${index} fact must be a non-empty string`);
    if (!OPERATORS.has(String(rule.operator)))
      diagnostics.push(`rule ${index} has an invalid operator`);
    if (!SEVERITIES.has(String(rule.severity)))
      diagnostics.push(`rule ${index} has an invalid severity`);
    if (
      (rule.operator === "equals" || rule.operator === "not_equals") &&
      typeof rule.value !== "string" &&
      typeof rule.value !== "boolean"
    ) {
      diagnostics.push(`rule ${index} requires a string or boolean value`);
    }
  }
  return diagnostics;
}

function toPolicy(value: Record<string, unknown>): Policy {
  return {
    id: value.id as string,
    version: 1,
    enabled: value.enabled !== false,
    ...(Array.isArray(value.templates) ? { templates: value.templates as PolicyTemplateId[] } : {}),
    rules: (value.rules as Record<string, unknown>[]).map((rule) => ({
      id: rule.id as string,
      fact: rule.fact as string,
      operator: rule.operator as PolicyRule["operator"],
      ...(rule.value === undefined ? {} : { value: rule.value as string | boolean }),
      severity: rule.severity as PolicyRule["severity"]
    }))
  };
}

function unknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  label: string
): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${label} has unknown field '${key}'`);
}

function invalid(diagnostic: string): PolicyParseResult {
  return { ok: false, diagnostics: [diagnostic] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
