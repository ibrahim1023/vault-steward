import type { Finding, FindingSeverity } from "../contracts/index.js";
import {
  compactDashboardFindings,
  filterDashboardFindings,
  type FindingQueueFilter
} from "./dashboard.js";

const DEFAULT_FILTER: FindingQueueFilter = { severity: "all", query: "" };

export function PriorityFindings({
  findings,
  selectedFindingId,
  onSelect,
  expanded = false,
  filter = DEFAULT_FILTER,
  onFilterChange = () => undefined,
  onToggleExpanded = () => undefined
}: {
  findings: readonly Finding[];
  selectedFindingId: string | undefined;
  onSelect: (findingId: string) => void;
  expanded?: boolean;
  filter?: FindingQueueFilter;
  onFilterChange?: (filter: FindingQueueFilter) => void;
  onToggleExpanded?: () => void;
}) {
  const filteredFindings = filterDashboardFindings(findings, filter);
  const queue = expanded ? filteredFindings : compactDashboardFindings(findings);

  return (
    <section className="priority-findings" aria-label="Priority findings">
      <h2>Priority findings</h2>
      {expanded ? (
        <div className="finding-filters">
          <label>
            Severity
            <select
              aria-label="Finding severity filter"
              value={filter.severity}
              onChange={(event) =>
                onFilterChange({
                  ...filter,
                  severity: event.target.value as FindingSeverity | "all"
                })
              }
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </label>
          <label>
            Search
            <input
              aria-label="Search findings"
              value={filter.query}
              onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
            />
          </label>
        </div>
      ) : null}
      {queue.length === 0 ? (
        <p>
          {findings.length === 0
            ? "No findings need review."
            : "No findings match the current filters."}
        </p>
      ) : (
        <ul>
          {queue.map((finding) => {
            const selected = finding.id === selectedFindingId;
            const evidence = finding.evidence[0];
            return (
              <li key={finding.id}>
                <button
                  type="button"
                  className={`finding-row finding-row-severity-${finding.severity}`}
                  aria-pressed={selected}
                  aria-label={`${finding.severity} finding: ${finding.explanation}, ${
                    evidence
                      ? `source ${evidence.notePath}, ${evidence.locator}`
                      : "no source evidence"
                  }${selected ? ", selected" : ""}`}
                  onClick={() => onSelect(finding.id)}
                >
                  <span className="finding-row-severity">{capitalize(finding.severity)}</span>
                  <span className="finding-row-summary">{finding.explanation}</span>
                  {evidence ? (
                    <span className="finding-row-source">
                      <span>{evidence.notePath}</span> <span>{evidence.locator}</span>
                    </span>
                  ) : (
                    <span className="finding-row-source">No source evidence</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {findings.length > 3 || expanded ? (
        <button type="button" onClick={onToggleExpanded}>
          {expanded ? "Show priority findings" : "View all findings"}
        </button>
      ) : null}
    </section>
  );
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1);
}
