import type { Finding } from "../contracts/index.js";
import { groupDashboardFindings } from "./dashboard.js";

export function PriorityFindings({
  findings,
  selectedFindingId,
  onSelect
}: {
  findings: readonly Finding[];
  selectedFindingId: string | undefined;
  onSelect: (findingId: string) => void;
}) {
  return (
    <section aria-label="Priority findings">
      <h2>Priority findings</h2>
      {findings.length === 0 ? (
        <p>No findings need review.</p>
      ) : (
        <div>
          {groupDashboardFindings(findings).map(({ severity, findings: groupedFindings }) => (
            <section key={severity} aria-label={`${severity} findings`}>
              <h3>{severity}</h3>
              <ul>
                {groupedFindings.map((finding) => {
                  const selected = finding.id === selectedFindingId;
                  return (
                    <li key={finding.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${finding.severity} finding: ${finding.explanation}${selected ? ", selected" : ""}`}
                        onClick={() => onSelect(finding.id)}
                      >
                        {finding.explanation}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
