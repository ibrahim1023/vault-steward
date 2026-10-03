import type { ChangesSummary } from "../maintenance/changes.js";

export function ChangesView({
  summary,
  onSelectBaseline
}: {
  summary: ChangesSummary;
  onSelectBaseline?: (scanId: string) => void;
}) {
  return (
    <section aria-label="Changes since last check" className="changes-view">
      <h2>Changes since last check</h2>
      {summary.status === "no-scan" ? <p>Run a check to establish your first baseline.</p> : null}
      {summary.status === "legacy" ? (
        <p>
          This scan is not comparable with earlier history. Run a new check with current identity.
        </p>
      ) : null}
      {summary.status === "baseline" ? (
        <p>
          Scan {summary.currentScanId} is the first comparable baseline. Run another check to see
          changes.
        </p>
      ) : null}
      {summary.status === "compared" ? (
        <>
          <p>Current scan: {summary.currentScanId}</p>
          <label>
            Compare with
            <select
              value={summary.baselineScanId}
              onChange={(event) => onSelectBaseline?.(event.target.value)}
            >
              {summary.availableBaselineScanIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <ul>
            {(["new", "changed", "recurring", "resolved", "unchanged"] as const).map((kind) => (
              <li key={kind}>
                {summary[kind].length} {kind}
                {summary[kind].length > 0 ? (
                  <ul>
                    {summary[kind].map((item) => (
                      <li key={item.stableKey}>
                        {item.family}: {item.subtype} — {item.detail}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {summary.new.length +
            summary.changed.length +
            summary.recurring.length +
            summary.resolved.length ===
          0 ? (
            <p>No findings changed since this baseline.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
