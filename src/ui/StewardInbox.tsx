import { useState } from "react";

import type { FindingV2 } from "../contracts/index.js";
import type { InboxDispositionRequest, StewardInboxItem } from "../review/dispositions.js";

type Action = InboxDispositionRequest["kind"];
type SnoozeBound = { untilAt: string } | { untilEvidenceChanges: true };
type Filter = "all" | "due" | Action;
const REPAIR_REVIEW_TYPES = new Set([
  "broken-reference",
  "invalid-reference",
  "reference-normalization",
  "task",
  "decision",
  "schema",
  "entity-alias"
]);

function isFutureDate(value: string | undefined): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > Date.now();
}

export function StewardInbox({
  snapshot,
  onDisposition,
  onRestore,
  onReviewFix,
  onInspect
}: {
  snapshot: { items: readonly StewardInboxItem[]; criticalCount: number };
  onDisposition: (
    occurrenceIds: string[],
    kind: Action,
    snooze?: SnoozeBound
  ) => void | Promise<void>;
  onRestore?: (occurrenceId: string) => void | Promise<void>;
  onReviewFix?: (finding: FindingV2) => void;
  onInspect?: (finding: FindingV2) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [snoozeDates, setSnoozeDates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const visible = snapshot.items.filter((item) =>
    filter === "all"
      ? true
      : filter === "due"
        ? item.disposition === null
        : item.disposition?.kind === filter
  );
  const selectedIds = visible
    .filter((item) => selected.has(item.occurrenceId))
    .map((item) => item.occurrenceId);
  const act = async (ids: string[], kind: Action, snooze?: SnoozeBound) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onDisposition(ids, kind, snooze);
      setSelected(new Set());
    } catch {
      setError("The Inbox decision could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const restore = async (id: string) => {
    if (!onRestore || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onRestore(id);
    } catch {
      setError("The Inbox decision could not be restored. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="steward-inbox" aria-label="Steward Inbox">
      <h2>Steward Inbox</h2>
      <p role="status">{snapshot.criticalCount} critical findings</p>
      <label>
        Filter Inbox
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          {(["all", "due", "acknowledged", "ignored", "snoozed", "expected"] as const).map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            )
          )}
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {selectedIds.length > 0 ? (
        <button type="button" disabled={busy} onClick={() => void act(selectedIds, "acknowledged")}>
          Acknowledge selected ({selectedIds.length})
        </button>
      ) : null}
      {visible.length === 0 ? (
        <p>No findings match this filter.</p>
      ) : (
        <ul>
          {visible.map((item) => (
            <li key={item.occurrenceId} aria-label={item.finding.explanation}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(item.occurrenceId)}
                  onChange={() => {
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (next.has(item.occurrenceId)) next.delete(item.occurrenceId);
                      else next.add(item.occurrenceId);
                      return next;
                    });
                  }}
                />
                Select {item.finding.explanation}
              </label>
              <strong>
                {item.finding.severity}: {item.finding.explanation}
              </strong>
              <span> {item.disposition?.kind ?? "due"}</span>
              {item.disposition && onRestore ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void restore(item.occurrenceId)}
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act([item.occurrenceId], "acknowledged")}
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act([item.occurrenceId], "ignored")}
                  >
                    Ignore this occurrence
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act([item.occurrenceId], "snoozed", { untilEvidenceChanges: true })
                    }
                  >
                    Snooze until evidence changes
                  </button>
                  <label>
                    Snooze until
                    <input
                      type="datetime-local"
                      value={snoozeDates[item.occurrenceId] ?? ""}
                      onChange={(event) =>
                        setSnoozeDates((dates) => ({
                          ...dates,
                          [item.occurrenceId]: event.target.value
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !isFutureDate(snoozeDates[item.occurrenceId])}
                    onClick={() =>
                      void act([item.occurrenceId], "snoozed", {
                        untilAt: new Date(snoozeDates[item.occurrenceId]!).toISOString()
                      })
                    }
                  >
                    Snooze until date
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act([item.occurrenceId], "expected")}
                  >
                    Mark expected
                  </button>
                </>
              )}
              {(item.finding.suggestedFixes.length > 0 ||
                REPAIR_REVIEW_TYPES.has(item.finding.type)) &&
              onReviewFix ? (
                <button type="button" onClick={() => onReviewFix(item.finding)}>
                  Review fix
                </button>
              ) : null}
              {onInspect ? (
                <button type="button" onClick={() => onInspect(item.finding)}>
                  Inspect finding
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
