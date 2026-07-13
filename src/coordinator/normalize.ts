import type { Finding } from "../contracts/index.js";

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

function severityRank(value: Finding["severity"]): number {
  return ["info", "low", "medium", "high", "critical"].indexOf(value);
}
