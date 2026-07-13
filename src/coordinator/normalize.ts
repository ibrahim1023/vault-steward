import type { Finding } from "../contracts/index.js";
import type { VaultStewardRepository } from "../storage/repositories.js";

export function normalizeFindings(findings: readonly Finding[]): Finding[] {
  const unique = new Map<string, Finding>();
  for (const finding of findings) {
    if (finding.confidence < 0 || finding.confidence > 1 || finding.evidence.length === 0) continue;
    const key = `${finding.scanId}:${finding.type}:${finding.evidence.map((e) => `${e.notePath}:${e.locator}`).join("|")}`;
    if (!unique.has(key)) unique.set(key, finding);
  }
  return [...unique.values()].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || a.id.localeCompare(b.id)
  );
}

export function persistReviewQueue(
  repository: VaultStewardRepository,
  findings: readonly Finding[]
): Finding[] {
  const normalized = normalizeFindings(findings);
  for (const finding of normalized) {
    repository.saveFinding({
      id: finding.id,
      scanId: finding.scanId,
      type: finding.type,
      severity: finding.severity,
      status: finding.status,
      evidenceJson: JSON.stringify(finding.evidence),
      payloadJson: JSON.stringify({
        confidence: finding.confidence,
        explanation: finding.explanation,
        violatedPolicyId: finding.violatedPolicyId
      })
    });
  }
  return normalized;
}

function severityRank(value: Finding["severity"]): number {
  return ["info", "low", "medium", "high", "critical"].indexOf(value);
}
