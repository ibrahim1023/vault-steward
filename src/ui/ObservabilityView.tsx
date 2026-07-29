import { useMemo, useState } from "react";

import { serializeTraceExport } from "../observability/trace-export.js";
import type { ScanHistoryRecord, ObservabilitySnapshot } from "../storage/repositories.js";

export function ObservabilityView({
  scans,
  loadObservability,
  selectedFindingId,
  deleteScanTrace,
  deleteAllTraceData
}: {
  scans: readonly ScanHistoryRecord[];
  loadObservability: (scanId?: string) => ObservabilitySnapshot;
  selectedFindingId?: string;
  deleteScanTrace?: (scanId: string) => Promise<void>;
  deleteAllTraceData?: () => Promise<void>;
}) {
  const [scanId, setScanId] = useState(scans[0]?.id);
  const [confirming, setConfirming] = useState<"scan" | "all">();
  const [error, setError] = useState<string>();
  const [exported, setExported] = useState(false);
  const snapshot = useMemo(() => {
    try {
      return loadObservability(scanId);
    } catch {
      return undefined;
    }
  }, [loadObservability, scanId]);
  const lineage = selectedFindingId
    ? (snapshot?.lineage.filter((item) => item.findingId === selectedFindingId) ?? [])
    : (snapshot?.lineage ?? []);

  const remove = async (scope: "scan" | "all") => {
    setError(undefined);
    try {
      if (scope === "scan") {
        if (!snapshot?.scanId || !deleteScanTrace) return;
        await deleteScanTrace(snapshot.scanId);
      } else {
        if (!deleteAllTraceData) return;
        await deleteAllTraceData();
      }
      setConfirming(undefined);
    } catch {
      setError("Local trace data could not be deleted.");
    }
  };

  const exportTrace = async () => {
    if (!snapshot) return;
    try {
      const payload = serializeTraceExport(snapshot, new Date().toISOString());
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable.");
      await navigator.clipboard.writeText(payload);
      setExported(true);
      setError(undefined);
    } catch {
      setExported(false);
      setError("The privacy-safe trace export could not be copied locally.");
    }
  };

  return (
    <details className="observability-view">
      <summary>Observability</summary>
      {scans.length > 0 ? (
        <label>
          Scan
          <select
            aria-label="Observability scan"
            value={scanId ?? ""}
            onChange={(event) => setScanId(event.target.value)}
          >
            {scans.map((scan) => (
              <option key={scan.id} value={scan.id}>
                {scan.status} {scan.startedAt}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!snapshot ? <p role="status">Local trace data is unavailable.</p> : null}
      {snapshot ? (
        <div className="observability-content">
          <section aria-label="Scan timeline">
            <h3>Timeline</h3>
            {snapshot.timeline.length === 0 ? (
              <p>No timeline is available for this scan.</p>
            ) : (
              <ul className="observability-timeline">
                {snapshot.timeline.map((span) => (
                  <li key={span.id}>
                    <strong style={{ paddingLeft: `${span.parentSpanId ? 12 : 0}px` }}>
                      {span.kind}
                    </strong>
                    <span>{span.outcome}</span>
                    <span>
                      {span.durationMs === null ? "not completed" : `${span.durationMs} ms`}
                    </span>
                    {span.retryCount > 0 ? <span>{span.retryCount} retries</span> : null}
                    {span.fileCount !== null ? <span>{span.fileCount} files</span> : null}
                    {span.errorCode ? <code>{span.errorCode}</code> : null}
                    {Object.keys(span.attributes).length > 0 ? (
                      <small>{Object.entries(span.attributes).map(([key, value]) => `${key}: ${value}`).join(", ")}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Finding lineage">
            <h3>Finding lineage</h3>
            {lineage.length === 0 ? (
              <p>No metadata-only lineage is available for this selection.</p>
            ) : (
              lineage.map((item) => (
                <dl key={item.findingId} className="observability-lineage">
                  <dt>Evidence</dt>
                  <dd>{item.evidenceLocators.join(", ")}</dd>
                  <dt>Parsed artifacts</dt>
                  <dd>{item.parsedArtifactIds.join(", ")}</dd>
                  <dt>Retrieval</dt>
                  <dd>{item.retrievalMetadata.join(", ") || "not run"}</dd>
                  <dt>Agent execution</dt>
                  <dd>{item.agentExecutionId ?? "not run"}</dd>
                  <dt>Validation</dt>
                  <dd>{item.validatorId}</dd>
                  <dt>Policy</dt>
                  <dd>{item.policyEvaluationId ?? "not run"}</dd>
                  <dt>Coordinator</dt>
                  <dd>{item.coordinatorDecisionId}</dd>
                  <dt>Proposal source</dt>
                  <dd>{item.proposalSourceId ?? "not applicable"}</dd>
                </dl>
              ))
            )}
          </section>
          <section aria-label="Scan configuration">
            <h3>Configuration</h3>
            {snapshot.configuration ? (
              <dl className="observability-configuration">
                <dt>Fingerprint</dt>
                <dd>
                  <code>{snapshot.configuration.fingerprint}</code>
                </dd>
                {Object.entries(snapshot.configuration.values).map(([key, value]) => (
                  <span key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </span>
                ))}
              </dl>
            ) : (
              <p>No configuration fingerprint was retained for this scan.</p>
            )}
          </section>
          <section aria-label="Stored trace data">
            <h3>Stored data</h3>
            <p>
              <button type="button" onClick={() => void exportTrace()}>
                Copy privacy-safe JSON export
              </button>
              {exported ? <span role="status">Trace JSON copied locally.</span> : null}
            </p>
            <p>
              {snapshot.inventory.spans} spans, {snapshot.inventory.agentExecutions} agent
              executions, and {snapshot.inventory.findingLineage} lineage records.
            </p>
            <p>
              Prompt snapshots:{" "}
              {snapshot.inventory.categories.promptSnapshots.enabled ? "enabled" : "disabled"};
              model-output snapshots:{" "}
              {snapshot.inventory.categories.modelOutputSnapshots.enabled ? "enabled" : "disabled"}.
            </p>
            {confirming ? (
              <p>
                <button type="button" onClick={() => void remove(confirming)}>
                  Confirm delete trace data
                </button>
                <button type="button" onClick={() => setConfirming(undefined)}>
                  Cancel
                </button>
              </p>
            ) : (
              <p>
                {deleteScanTrace && snapshot.scanId ? (
                  <button type="button" onClick={() => setConfirming("scan")}>
                    Delete this scan's trace
                  </button>
                ) : null}
                {deleteAllTraceData ? (
                  <button type="button" onClick={() => setConfirming("all")}>
                    Delete all trace data
                  </button>
                ) : null}
              </p>
            )}
            {error ? <p role="alert">{error}</p> : null}
          </section>
          <section aria-label="Operational metrics">
            <h3>Operational metrics</h3>
            <dl className="observability-configuration">
              <dt>Scan p50 / p95</dt>
              <dd>
                {formatMetric(snapshot.metrics.p50ScanDurationMs)} /{" "}
                {formatMetric(snapshot.metrics.p95ScanDurationMs)}
              </dd>
              <dt>Agent duration</dt>
              <dd>{snapshot.metrics.agentDurationMs} ms</dd>
              <dt>Failures</dt>
              <dd>
                {snapshot.metrics.parseFailures +
                  snapshot.metrics.indexFailures +
                  snapshot.metrics.retrievalFailures +
                  snapshot.metrics.validationFailures}
              </dd>
              <dt>Queue depth</dt>
              <dd>{snapshot.metrics.queueDepth}</dd>
              <dt>Tokens / retries</dt>
              <dd>
                {snapshot.metrics.tokenUsage} / {snapshot.metrics.retries}
              </dd>
              <dt>Database size</dt>
              <dd>{snapshot.metrics.databaseBytes} bytes</dd>
              <dt>Stale / apply failures</dt>
              <dd>
                {snapshot.metrics.staleProposals} / {snapshot.metrics.applyFailures}
              </dd>
            </dl>
          </section>
        </div>
      ) : null}
    </details>
  );
}

function formatMetric(value: number | null): string {
  return value === null ? "not enough data" : `${value} ms`;
}
