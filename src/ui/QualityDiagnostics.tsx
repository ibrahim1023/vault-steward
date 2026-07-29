import { summarizeKnowledgeHealth } from "../observability/knowledge-health.js";
import type {
  FindingLifecycleRecord,
  ObservabilitySnapshot,
  ScanHistoryRecord
} from "../storage/repositories.js";

export function QualityDiagnostics({
  scans,
  lifecycle,
  snapshot
}: {
  scans: readonly ScanHistoryRecord[];
  lifecycle: readonly FindingLifecycleRecord[];
  snapshot: ObservabilitySnapshot;
}) {
  const health = summarizeKnowledgeHealth(lifecycle);
  return (
    <details className="quality-diagnostics">
      <summary>Evaluation and quality</summary>
      <section aria-label="Evaluation dashboard">
        <h3>Evaluation dashboard</h3>
        <p>
          Fixture and model reports are generated locally through the evaluation commands. They are
          not retained in the vault database by default.
        </p>
        <p role="status">No imported local evaluation report is available.</p>
      </section>
      <section aria-label="Agent performance dashboard">
        <h3>Agent performance</h3>
        <dl className="observability-configuration">
          <dt>Agent duration</dt>
          <dd>{snapshot.metrics.agentDurationMs} ms</dd>
          <dt>Retries</dt>
          <dd>{snapshot.metrics.retries}</dd>
          <dt>Tokens</dt>
          <dd>{snapshot.metrics.tokenUsage}</dd>
          <dt>Validation failures</dt>
          <dd>{snapshot.metrics.validationFailures}</dd>
          <dt>Open findings</dt>
          <dd>{snapshot.metrics.queueDepth}</dd>
          <dt>Incomplete scan rate</dt>
          <dd>{Math.round(snapshot.metrics.incompleteRate * 100)}%</dd>
        </dl>
      </section>
      <section aria-label="Knowledge health trends">
        <h3>Knowledge health trends</h3>
        {scans.length === 0 ? <p role="status">No retained scan history is available.</p> : null}
        <dl className="observability-configuration">
          <dt>Active / resolved</dt>
          <dd>
            {health.activeFindings} / {health.resolvedFindings}
          </dd>
          <dt>Recurring</dt>
          <dd>{health.recurringFindings}</dd>
          <dt>Stale lifecycle records</dt>
          <dd>{health.staleFindings}</dd>
          <dt>Severity trend</dt>
          <dd>
            {Object.entries(health.severityCounts)
              .map(([severity, count]) => `${severity}: ${count}`)
              .join(", ") || "unavailable"}
          </dd>
        </dl>
        {health.byType.length > 0 ? (
          <ul className="health-trend-list">
            {health.byType.map((row) => (
              <li key={row.type}>
                {row.type}: {row.active} active, {row.resolved} resolved, {row.recurring} recurring
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-label="Replay workspace">
        <h3>Replay workspace</h3>
        <p>
          Retained vault scans contain metadata only and cannot be replayed. Run a local fixture
          replay to compare one model, prompt, threshold, retrieval, policy, or agent change.
        </p>
        <p>
          {scans.length === 0
            ? "No eligible fixture replay is retained."
            : "Fixture source content is unavailable for retained vault scans."}
        </p>
      </section>
    </details>
  );
}

export function AIDebugConsole({ snapshot }: { snapshot: ObservabilitySnapshot }) {
  return (
    <details className="ai-debug-console">
      <summary>AI debug console</summary>
      <p>Local diagnostic metadata only. This console cannot write notes or replay vault scans.</p>
      <dl className="observability-configuration">
        <dt>Configuration</dt>
        <dd>{snapshot.configuration?.fingerprint ?? "not retained"}</dd>
        <dt>Prompt snapshots</dt>
        <dd>{snapshot.inventory.categories.promptSnapshots.enabled ? "opted in" : "disabled"}</dd>
        <dt>Model-output snapshots</dt>
        <dd>
          {snapshot.inventory.categories.modelOutputSnapshots.enabled ? "opted in" : "disabled"}
        </dd>
        <dt>Retrieval spans</dt>
        <dd>{snapshot.timeline.filter((span) => span.kind === "retrieval").length}</dd>
        <dt>Validation spans</dt>
        <dd>{snapshot.timeline.filter((span) => span.kind === "validation").length}</dd>
      </dl>
      <h3>Opted-in redacted snapshots</h3>
      {snapshot.snapshots.length === 0 ? (
        <p>No opted-in redacted snapshots are retained.</p>
      ) : (
        <ul className="debug-snapshot-list">
          {snapshot.snapshots.map((item) => (
            <li key={`${item.category}:${item.createdAt}`}>
              <strong>{item.category}</strong> <span>{item.byteCount} bytes</span>
              <code>{JSON.stringify(item.metadata)}</code>
            </li>
          ))}
        </ul>
      )}
      <p>
        Replay one synthetic fixture case with{" "}
        <code>npm run evals -- --replay --manifest &lt;manifest&gt; --case &lt;case-id&gt;</code>.
      </p>
    </details>
  );
}
