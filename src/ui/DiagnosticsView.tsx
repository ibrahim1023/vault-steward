import { useState, type JSX } from "react";

import { recurringSuppressionCandidates } from "../feedback/local-learning.js";
import type { MaintenanceSchedule, MaintenanceScheduleState } from "../maintenance/scheduler.js";
import type { ModelReadiness } from "../model-provider/readiness.js";
import type { ReviewerFeedbackRecord } from "../storage/repositories.js";

export type DiagnosticsViewProps = {
  checkConnection: () => Promise<ModelReadiness>;
  maintenance: {
    schedule: MaintenanceSchedule;
    state: MaintenanceScheduleState;
    setPaused: (paused: boolean) => Promise<void>;
  };
  feedbackRecords: readonly ReviewerFeedbackRecord[];
  suppressedPatterns: readonly string[];
  suppressPattern: (pattern: string) => Promise<void>;
  deleteDiagnosticTraces: () => Promise<void>;
};

type ConnectionState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ready"; provider: string; model: string }
  | { status: "error" };

export function DiagnosticsView({
  checkConnection,
  maintenance,
  feedbackRecords,
  suppressedPatterns,
  suppressPattern,
  deleteDiagnosticTraces
}: DiagnosticsViewProps): JSX.Element {
  const [connection, setConnection] = useState<ConnectionState>({ status: "idle" });
  const [maintenancePaused, setMaintenancePaused] = useState(maintenance.schedule.paused);
  const [maintenancePending, setMaintenancePending] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState(false);
  const [suppressingPattern, setSuppressingPattern] = useState<string>();
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [deletionState, setDeletionState] = useState<"idle" | "deleting" | "deleted" | "error">(
    "idle"
  );
  const candidates = recurringSuppressionCandidates(feedbackRecords);

  const runConnectionCheck = async () => {
    setConnection({ status: "checking" });
    try {
      const result = await checkConnection();
      setConnection(
        result.available && result.structuredOutput
          ? { status: "ready", provider: result.provider, model: result.model }
          : { status: "error" }
      );
    } catch {
      setConnection({ status: "error" });
    }
  };

  const toggleMaintenance = async () => {
    const nextPaused = !maintenancePaused;
    setMaintenancePending(true);
    setMaintenanceError(false);
    try {
      await maintenance.setPaused(nextPaused);
      setMaintenancePaused(nextPaused);
    } catch {
      setMaintenanceError(true);
    } finally {
      setMaintenancePending(false);
    }
  };

  const suppress = async (pattern: string) => {
    setSuppressingPattern(pattern);
    try {
      await suppressPattern(pattern);
    } finally {
      setSuppressingPattern(undefined);
    }
  };

  const deleteTraces = async () => {
    setDeletionState("deleting");
    try {
      await deleteDiagnosticTraces();
      setDeletionState("deleted");
      setConfirmingDeletion(false);
    } catch {
      setDeletionState("error");
    }
  };

  return (
    <details className="diagnostics-view">
      <summary>Diagnostics</summary>
      <div className="diagnostics-content">
        <p className="diagnostics-intro">
          Connection, automatic checks, and controls that stay on this device.
        </p>

        <section className="diagnostic-card" aria-label="Model connection">
          <div className="diagnostic-card-heading">
            <h3>Model connection</h3>
            {connection.status === "idle" ? <p>Check that your selected model is ready.</p> : null}
            {connection.status === "checking" ? <p role="status">Checking model…</p> : null}
            {connection.status === "ready" ? (
              <p className="diagnostic-status" data-state="ready" role="status">
                Model ready · {providerLabel(connection.provider)} · {connection.model}
              </p>
            ) : null}
            {connection.status === "error" ? (
              <p className="diagnostic-status" data-state="error" role="alert">
                Model needs attention. Check your provider settings and try again.
              </p>
            ) : null}
          </div>
          <button
            className="diagnostic-action"
            type="button"
            disabled={connection.status === "checking"}
            onClick={() => void runConnectionCheck()}
          >
            {connection.status === "checking" ? "Checking connection…" : "Check connection"}
          </button>
        </section>

        <section className="diagnostic-card" aria-label="Automatic checks">
          <div className="diagnostic-card-heading">
            <h3>Automatic checks</h3>
            <p>{maintenanceStatus(maintenance.schedule.enabled, maintenancePaused)}</p>
            <p>
              Last checked: {formatLocalTime(maintenance.state.lastRunAt, "Not run yet")} · Next:{" "}
              {formatLocalTime(maintenance.state.nextRunAt, "Not scheduled")}
            </p>
            {maintenanceError ? (
              <p className="diagnostic-status" data-state="error" role="alert">
                Automatic checks could not be updated. Try again.
              </p>
            ) : null}
          </div>
          {maintenance.schedule.enabled ? (
            <button
              className="diagnostic-action"
              type="button"
              disabled={maintenancePending}
              onClick={() => void toggleMaintenance()}
            >
              {maintenancePending ? "Updating…" : maintenancePaused ? "Resume" : "Pause"}
            </button>
          ) : null}
        </section>

        <section className="diagnostic-card diagnostic-review" aria-label="Review preferences">
          <div className="diagnostic-card-heading">
            <h3>Review preferences</h3>
            <p>Feedback stays on this device and only changes review order or local suppression.</p>
            {candidates.length === 0 ? (
              <p>No repeated false-positive patterns need your review.</p>
            ) : (
              <ul className="diagnostic-patterns">
                {candidates.map((candidate) => {
                  const suppressed = suppressedPatterns.includes(candidate.key);
                  return (
                    <li key={candidate.key}>
                      <div>
                        <strong>{feedbackPatternLabel(candidate.key)}</strong>
                        <span>{candidate.count} local false-positive reports</span>
                      </div>
                      <button
                        className="diagnostic-action"
                        type="button"
                        disabled={suppressed || suppressingPattern === candidate.key}
                        onClick={() => void suppress(candidate.key)}
                      >
                        {suppressed
                          ? "Suppressed from primary review"
                          : suppressingPattern === candidate.key
                            ? "Updating…"
                            : "Suppress from primary review"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="diagnostic-card diagnostic-data" aria-label="Local diagnostic data">
          <div className="diagnostic-card-heading">
            <h3>Local diagnostic data</h3>
            <p>Technical scan traces stay on this device.</p>
            <p>Deleting traces never changes your notes or issue history.</p>
            {deletionState === "deleted" ? (
              <p className="diagnostic-status" data-state="ready" role="status">
                Diagnostic traces deleted.
              </p>
            ) : null}
            {deletionState === "error" ? (
              <p className="diagnostic-status" data-state="error" role="alert">
                Diagnostic traces could not be deleted. Try again.
              </p>
            ) : null}
            {confirmingDeletion ? (
              <div className="diagnostic-confirmation">
                <p>Delete all local diagnostic traces?</p>
                <button
                  className="diagnostic-action diagnostic-danger"
                  type="button"
                  disabled={deletionState === "deleting"}
                  onClick={() => void deleteTraces()}
                >
                  {deletionState === "deleting" ? "Deleting…" : "Confirm deletion"}
                </button>
                <button
                  className="diagnostic-action"
                  type="button"
                  disabled={deletionState === "deleting"}
                  onClick={() => {
                    setConfirmingDeletion(false);
                    setDeletionState("idle");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="diagnostic-action diagnostic-danger"
                type="button"
                onClick={() => {
                  setDeletionState("idle");
                  setConfirmingDeletion(true);
                }}
              >
                Delete diagnostic traces
              </button>
            )}
          </div>
        </section>
      </div>
    </details>
  );
}

function providerLabel(provider: string): string {
  if (provider === "hyperfusion") return "HyperFusion";
  if (provider === "openai") return "OpenAI";
  if (provider === "llama.cpp") return "llama.cpp";
  return provider === "ollama" ? "Ollama" : "Configured model";
}

function maintenanceStatus(enabled: boolean, paused: boolean): string {
  if (!enabled) return "Disabled";
  return paused ? "Paused" : "Active";
}

function formatLocalTime(value: number | undefined, fallback: string): string {
  return value === undefined ? fallback : new Date(value).toLocaleString();
}

function feedbackPatternLabel(key: string): string {
  const separator = key.indexOf(":");
  if (separator < 1) return "Repeated issue pattern";
  const type = key.slice(0, separator).replaceAll("-", " ");
  const notes = key
    .slice(separator + 1)
    .split("|")
    .filter(Boolean);
  if (notes.length === 1) return `Repeated ${type} issue in ${notes[0]}`;
  return `Repeated ${type} issue across ${notes.length} notes`;
}
