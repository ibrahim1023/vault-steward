import type { Finding } from "../contracts/index.js";
import type { LocalProvider } from "../model-provider/local-provider.js";

const MAX_EVIDENCE_ITEMS = 4;
const MAX_EXCERPT_CHARACTERS = 600;

export type FindingExplanation =
  | { ok: true; text: string; latencyMs: number }
  | { ok: false; code: "provider-unavailable" | "response-invalid" };

export function buildFindingExplanationPrompt(finding: Finding): string {
  const evidence = finding.evidence.slice(0, MAX_EVIDENCE_ITEMS).map((item) => ({
    path: item.notePath,
    locator: item.locator,
    excerpt: item.excerpt.slice(0, MAX_EXCERPT_CHARACTERS)
  }));
  return [
    "Explain only the cited evidence for this Vault Steward finding.",
    "Do not claim facts outside the evidence. Do not suggest edits. Return concise plain text.",
    JSON.stringify({
      type: finding.type,
      severity: finding.severity,
      explanation: finding.explanation,
      policyId: finding.violatedPolicyId ?? null,
      evidence
    })
  ].join("\n");
}

export async function explainFinding(
  provider: LocalProvider,
  finding: Finding
): Promise<FindingExplanation> {
  try {
    const response = await provider.generate({
      prompt: buildFindingExplanationPrompt(finding),
      maxOutputTokens: 256
    });
    const text = response.text.trim();
    return text.length > 0 && text.length <= 8_000
      ? { ok: true, text, latencyMs: response.latencyMs }
      : { ok: false, code: "response-invalid" };
  } catch {
    return { ok: false, code: "provider-unavailable" };
  }
}
