import { useMemo, useState } from "react";

import type { Finding, FindingSeverity, FindingStatus, FindingType } from "../contracts/index.js";

export type ReviewQueueStatus = "idle" | "scanning" | "error" | "ready";
export type ReviewFilter = {
  type?: FindingType;
  severity?: FindingSeverity;
  status?: FindingStatus;
  scanId?: string;
  policyId?: string;
  minimumConfidence?: number;
};

export function filterReviewFindings(
  findings: readonly Finding[],
  filter: ReviewFilter
): Finding[] {
  return findings.filter(
    (finding) =>
      (!filter.type || finding.type === filter.type) &&
      (!filter.severity || finding.severity === filter.severity) &&
      (!filter.status || finding.status === filter.status) &&
      (!filter.scanId || finding.scanId === filter.scanId) &&
      (!filter.policyId || finding.violatedPolicyId === filter.policyId) &&
      (filter.minimumConfidence === undefined || finding.confidence >= filter.minimumConfidence)
  );
}

export function ReviewQueueView({
  status,
  findings,
  errorMessage
}: {
  status: ReviewQueueStatus;
  findings: readonly Finding[];
  errorMessage?: string;
}) {
  const [filter, setFilter] = useState<ReviewFilter>({});
  const visible = useMemo(() => filterReviewFindings(findings, filter), [findings, filter]);
  const types = [...new Set(findings.map((finding) => finding.type))];
  const severities = [...new Set(findings.map((finding) => finding.severity))];
  const scans = [...new Set(findings.map((finding) => finding.scanId))];
  const policies = [
    ...new Set(
      findings.flatMap((finding) => (finding.violatedPolicyId ? [finding.violatedPolicyId] : []))
    )
  ];
  if (status === "idle") return <p>Ready to review findings.</p>;
  if (status === "scanning") return <p>Refreshing review queue...</p>;
  if (status === "error")
    return <p role="alert">{errorMessage ?? "The review queue is unavailable."}</p>;
  if (findings.length === 0) return <p>No findings require review.</p>;
  const updateMinimumConfidence = (value: string) =>
    setFilter(value === "" ? {} : { ...filter, minimumConfidence: Number(value) });
  return (
    <section aria-label="Review queue">
      <h2>Review queue</h2>
      <ReviewSelect
        label="Type"
        values={types}
        value={filter.type}
        onChange={(type) =>
          setFilter({ ...filter, ...(type ? { type: type as FindingType } : {}) })
        }
      />
      <ReviewSelect
        label="Severity"
        values={severities}
        value={filter.severity}
        onChange={(severity) =>
          setFilter({ ...filter, ...(severity ? { severity: severity as FindingSeverity } : {}) })
        }
      />
      <ReviewSelect
        label="Scan"
        values={scans}
        value={filter.scanId}
        onChange={(scanId) => setFilter({ ...filter, ...(scanId ? { scanId } : {}) })}
      />
      <ReviewSelect
        label="Policy"
        values={policies}
        value={filter.policyId}
        onChange={(policyId) => setFilter({ ...filter, ...(policyId ? { policyId } : {}) })}
      />
      <label>
        Minimum confidence{" "}
        <input
          aria-label="Minimum confidence"
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={filter.minimumConfidence ?? ""}
          onChange={(event) => updateMinimumConfidence(event.target.value)}
        />
      </label>
      <button type="button" onClick={() => setFilter({})}>
        Clear filters
      </button>
      {visible.length === 0 ? (
        <p>No findings match the current filters.</p>
      ) : (
        <ul>
          {groupFindings(visible).map(({ finding, duplicates }) => (
            <li key={finding.id}>
              <strong>{finding.severity}</strong>
              <p>{finding.explanation}</p>
              <p>{finding.evidence.map((e) => `${e.notePath} (${e.locator})`).join(", ")}</p>
              <p>Confidence: {finding.confidence}</p>
              <p>Status: {finding.status}</p>
              {duplicates > 1 ? <p>{duplicates} matching findings grouped</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewSelect({
  label,
  values,
  value,
  onChange
}: {
  label: string;
  values: readonly string[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function groupFindings(
  findings: readonly Finding[]
): Array<{ finding: Finding; duplicates: number }> {
  const groups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = `${finding.type}:${finding.evidence.map((e) => `${e.notePath}:${e.locator}`).join("|")}`;
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return [...groups.values()].map((items) => ({ finding: items[0]!, duplicates: items.length }));
}
