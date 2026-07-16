import {
  evaluatePolicies,
  extractPolicyFacts,
  type PolicyFactSource,
  type PolicyViolation
} from "./evaluate.js";
import { parsePolicy, type Policy } from "./parse.js";

export const POLICY_STUDIO_PATH = ".vault-steward/policy.yaml";
export const DEFAULT_POLICY_DRAFT = `id: vault-policy\nversion: 1\nenabled: true\nrules: []\n`;

export type PolicyPathValidation = { ok: true } | { ok: false; diagnostic: string };
export type PolicyPreview =
  | { ok: true; policy: Policy; violations: PolicyViolation[] }
  | { ok: false; diagnostics: string[] };

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
