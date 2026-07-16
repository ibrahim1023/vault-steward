import type { Finding } from "../contracts/index.js";
import { countDashboardFindings, DASHBOARD_SEVERITIES } from "./dashboard.js";

export function VaultHealthSummary({
  vaultLabel,
  findings,
  lastCompletedAt
}: {
  vaultLabel: string;
  findings: readonly Finding[];
  lastCompletedAt?: string;
}) {
  const counts = countDashboardFindings(findings);
  return (
    <section aria-label="Vault health">
      <h2>Vault health</h2>
      <p>Current vault: {vaultLabel}</p>
      {lastCompletedAt ? <p>Last completed scan: {lastCompletedAt}</p> : null}
      <ul aria-label="Finding counts">
        {DASHBOARD_SEVERITIES.map((severity) => (
          <li key={severity}>
            {severity[0]!.toUpperCase() + severity.slice(1)} {counts[severity]}
          </li>
        ))}
      </ul>
    </section>
  );
}
