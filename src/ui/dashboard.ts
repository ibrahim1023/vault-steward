import type { Finding, FindingSeverity } from "../contracts/index.js";
import { findingFeedbackPattern } from "../feedback/local-learning.js";

export const DASHBOARD_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

export type DashboardCounts = Record<FindingSeverity, number>;

export type FindingQueueFilter = { severity: FindingSeverity | "all"; query: string };

export function activeDashboardFindings(findings: readonly Finding[]): Finding[] {
  return findings.filter((finding) => finding.status === "open");
}

export function rankDashboardFindings(
  findings: readonly Finding[],
  options: { deprioritizedPatterns?: readonly string[] } = {}
): Finding[] {
  const severityIndex = new Map<FindingSeverity, number>(
    DASHBOARD_SEVERITIES.map((severity, index) => [severity, index])
  );
  return [...findings].sort(
    (left, right) =>
      Number((options.deprioritizedPatterns ?? []).includes(findingFeedbackPattern(left))) -
        Number((options.deprioritizedPatterns ?? []).includes(findingFeedbackPattern(right))) ||
      (severityIndex.get(left.severity) ?? DASHBOARD_SEVERITIES.length) -
        (severityIndex.get(right.severity) ?? DASHBOARD_SEVERITIES.length) ||
      right.confidence - left.confidence ||
      left.id.localeCompare(right.id)
  );
}

export function compactDashboardFindings(findings: readonly Finding[], limit = 3): Finding[] {
  return rankDashboardFindings(findings).slice(0, limit);
}

export function filterDashboardFindings(
  findings: readonly Finding[],
  filter: FindingQueueFilter
): Finding[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return rankDashboardFindings(findings).filter((finding) => {
    if (filter.severity !== "all" && finding.severity !== filter.severity) return false;
    if (!query) return true;

    const visibleText = [
      finding.explanation,
      ...finding.evidence.flatMap(({ notePath, locator }) => [notePath, locator])
    ]
      .join(" ")
      .toLocaleLowerCase();
    return visibleText.includes(query);
  });
}

export function selectNextBestAction(findings: readonly Finding[]): Finding | undefined {
  return rankDashboardFindings(findings)[0];
}

export function countDashboardFindings(findings: readonly Finding[]): DashboardCounts {
  const counts: DashboardCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export function selectDashboardFinding(
  findings: readonly Finding[],
  selectedId: string | undefined
): Finding | undefined {
  return selectedId ? findings.find((finding) => finding.id === selectedId) : undefined;
}

export function groupDashboardFindings(
  findings: readonly Finding[]
): Array<{ severity: FindingSeverity; findings: Finding[] }> {
  const ranked = rankDashboardFindings(findings);
  return DASHBOARD_SEVERITIES.flatMap((severity) => {
    const group = ranked.filter((finding) => finding.severity === severity);
    return group.length ? [{ severity, findings: group }] : [];
  });
}
