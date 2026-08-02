import {
  evaluatePolicies,
  extractPolicyFacts,
  type PolicyFactSource,
  type PolicyViolation
} from "./evaluate.js";
import { parsePolicy, type Policy } from "./parse.js";
import type { Finding } from "../contracts/index.js";
import {
  classifyPolicyTemplateNote,
  getPolicyTemplate,
  validatePolicyTemplateNote
} from "./templates.js";

export const POLICY_STUDIO_PATH = ".vault-steward/policy.yaml";
export const DEFAULT_POLICY_DRAFT = `id: vault-policy\nversion: 1\nenabled: true\nrules: []\n`;

export type PolicyPathValidation = { ok: true } | { ok: false; diagnostic: string };
export type PolicyPreview =
  | { ok: true; policy: Policy; violations: PolicyViolation[] }
  | { ok: false; diagnostics: string[] };
export type PolicyRuleDraft = { ok: true; source: string } | { ok: false; diagnostic: string };

export function validatePolicyStudioPath(path: string): PolicyPathValidation {
  if (path === POLICY_STUDIO_PATH) return { ok: true };
  return { ok: false, diagnostic: "Policy Studio may only write its active policy file." };
}

export function previewPolicyDraft(
  source: string,
  notes: readonly PolicyFactSource[]
): PolicyPreview {
  const parsed = parsePolicy(source);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    policy: parsed.value,
    violations: evaluatePolicies([parsed.value], extractPolicyFacts(notes))
  };
}

export function draftRuleFromFinding(input: {
  source: string;
  finding: Finding;
  note: PolicyFactSource & { headings: readonly string[] };
}): PolicyRuleDraft {
  const parsed = parsePolicy(input.source);
  if (!parsed.ok) return { ok: false, diagnostic: "The active policy draft is invalid." };
  const evidence = input.finding.evidence[0];
  if (
    input.finding.type !== "schema" ||
    !evidence ||
    evidence.notePath !== input.note.path ||
    !evidence.locator.startsWith("frontmatter:")
  ) {
    return { ok: false, diagnostic: "This finding cannot create a policy rule." };
  }
  const classification = classifyPolicyTemplateNote(input.note);
  if (!classification.templateId || !parsed.value.templates?.includes(classification.templateId)) {
    return { ok: false, diagnostic: "The finding does not match an active policy template." };
  }
  const field = evidence.locator.slice("frontmatter:".length);
  const template = getPolicyTemplate(classification.templateId);
  const issue = validatePolicyTemplateNote(input.note, [classification.templateId]).find(
    (candidate) => candidate.field === field && candidate.message === input.finding.explanation
  );
  const templateRule = template?.rules.find(
    (rule) => rule.fact === `${classification.templateId}.${field}`
  );
  if (!issue || !templateRule) {
    return { ok: false, diagnostic: "This finding is not a known template requirement." };
  }
  if (parsed.value.rules.some((rule) => rule.id === templateRule.id)) {
    return { ok: false, diagnostic: "That policy rule is already in the draft." };
  }
  return {
    ok: true,
    source: renderPolicy({ ...parsed.value, rules: [...parsed.value.rules, templateRule] })
  };
}

function renderPolicy(policy: Policy): string {
  const lines = [`id: ${policy.id}`, "version: 1", `enabled: ${policy.enabled}`];
  if (policy.templates?.length) {
    lines.push("templates:", ...policy.templates.map((template) => `  - ${template}`));
  }
  if (policy.rules.length === 0) return [...lines, "rules: []", ""].join("\n");
  lines.push("rules:");
  for (const rule of policy.rules) {
    lines.push(
      `  - id: ${rule.id}`,
      `    fact: ${rule.fact}`,
      `    operator: ${rule.operator}`,
      ...(rule.value === undefined ? [] : [`    value: ${JSON.stringify(rule.value)}`]),
      `    severity: ${rule.severity}`
    );
  }
  return [...lines, ""].join("\n");
}
