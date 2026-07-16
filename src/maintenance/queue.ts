import type { Finding } from "../contracts/index.js";
import { rankDashboardFindings } from "../ui/dashboard.js";

export type MaintenanceGroup = { key: string; representative: Finding; findings: Finding[] };

export function groupMaintenanceFindings(findings: readonly Finding[]): MaintenanceGroup[] {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings.filter((item) => item.status === "open")) {
    const key = `${finding.type}:${finding.evidence
      .map((item) => `${item.notePath}:${item.locator}`)
      .sort()
      .join("|")}`;
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  const grouped = [...groups.entries()].map(([key, members]) => ({
    key,
    findings: members,
    representative: rankDashboardFindings(members)[0]!
  }));
  const order = new Map(
    rankDashboardFindings(grouped.map((group) => group.representative)).map((finding, index) => [
      finding.id,
      index
    ])
  );
  return grouped.sort(
    (left, right) =>
      (order.get(left.representative.id) ?? 0) - (order.get(right.representative.id) ?? 0)
  );
}
