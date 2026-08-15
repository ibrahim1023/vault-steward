import type { FindingLifecycleRecord, ScanHistoryRecord } from "../storage/repositories.js";

export function HistoryView({
  scans,
  lifecycle
}: {
  scans: readonly ScanHistoryRecord[];
  lifecycle: readonly FindingLifecycleRecord[];
}) {
  if (scans.length === 0) return <p>No completed scan history is available.</p>;
  return (
    <section aria-label="Vault history">
      <h2>Vault history</h2>
      <h3>Scans</h3>
      <ul>
        {scans.map((scan) => (
          <li key={scan.id}>
            <strong>{scan.status}</strong> {scan.startedAt}
          </li>
        ))}
      </ul>
      <h3>Finding lifecycle</h3>
      {lifecycle.length === 0 ? (
        <p>No recurring findings are recorded.</p>
      ) : (
        <ul>
          {lifecycle.map((item) => (
            <li key={`${item.type}:${item.firstSeen}`}>
              {item.type}: first seen {item.firstSeen}, last seen {item.lastSeen}, occurrences{" "}
              {item.occurrences}, {item.resolved ? "resolved" : "active"}
              {item.stale ? ", stale" : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
