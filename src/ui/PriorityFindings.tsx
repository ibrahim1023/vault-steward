import type { Finding } from "../contracts/index.js";
import { rankDashboardFindings } from "./dashboard.js";

export function PriorityFindings({
  findings,
  selectedFindingId,
  onSelect
}: {
  findings: readonly Finding[];
  selectedFindingId?: string;
  onSelect: (findingId: string) => void;
}) {
  return (
    <section aria-label="Priority findings">
      <h2>Priority findings</h2>
      {findings.length === 0 ? (
        <p>No findings need review.</p>
      ) : (
        <ul>
          {rankDashboardFindings(findings).map((finding) => {
            const selected = finding.id === selectedFindingId;
            return (
              <li key={finding.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${finding.severity} finding: ${finding.explanation}${selected ? ", selected" : ""}`}
                  onClick={() => onSelect(finding.id)}
                >
                  {finding.severity}: {finding.explanation}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
