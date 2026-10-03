import { useState } from "react";

import type { IntegrityEvent } from "../contracts/integrity-event.js";

const PAGE_SIZE = 100;

export function IntegrityTimeline({
  events,
  onExport,
  onLoadOlder
}: {
  events: readonly IntegrityEvent[];
  onExport: (visibleEvents: readonly IntegrityEvent[]) => Promise<void>;
  onLoadOlder?: (beforeSequence: number) => Promise<IntegrityEvent[]>;
}) {
  const [pages, setPages] = useState<IntegrityEvent[][]>([]);
  const [noOlder, setNoOlder] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<"idle" | "busy" | "copied" | "failed">("idle");
  const current = pages.at(-1) ?? events;
  const referenceGroups = new Map<string, number>();
  const referenceCounts = new Map<string, number>();
  const referenceLabels = new Map<number, string[]>();
  for (const event of [...current].sort((a, b) => a.sequence - b.sequence)) {
    const labels: string[] = [];
    for (const [kind, id] of [
      ["Scan", event.scanId],
      ["Finding", event.stableKey],
      ["Occurrence", event.occurrenceId],
      ["Proposal", event.proposalId],
      ["Approval", event.approvalId]
    ] as const) {
      if (!id) continue;
      const key = `${kind}:${id}`;
      if (!referenceGroups.has(key)) {
        const count = (referenceCounts.get(kind) ?? 0) + 1;
        referenceCounts.set(kind, count);
        referenceGroups.set(key, count);
      }
      labels.push(`${kind} ${referenceGroups.get(key)}`);
    }
    referenceLabels.set(event.sequence, labels);
  }
  const oldest = current[0]?.sequence;
  const newest = current.at(-1)?.sequence;
  const loadOlder = async () => {
    if (!onLoadOlder || oldest === undefined || loading) return;
    setLoading(true);
    setPageError(false);
    try {
      const older = await onLoadOlder(oldest);
      if (older.length === 0) setNoOlder(true);
      else {
        setNoOlder(false);
        setPages((previous) => [...previous, older]);
      }
    } catch {
      setPageError(true);
    } finally {
      setLoading(false);
    }
  };
  const exportEvents = async () => {
    setExportStatus("busy");
    try {
      await onExport(current);
      setExportStatus("copied");
    } catch {
      setExportStatus("failed");
    }
  };
  return (
    <section className="integrity-timeline" aria-label="Integrity Timeline">
      <h2>Integrity Timeline</h2>
      <p>Review and audit history is separate from optional diagnostic traces.</p>
      <button type="button" disabled={exportStatus === "busy"} onClick={() => void exportEvents()}>
        Export redacted Timeline
      </button>
      {exportStatus === "copied" ? <p role="status">Redacted Timeline copied.</p> : null}
      {exportStatus === "failed" ? <p role="alert">Timeline could not be exported.</p> : null}
      {pageError ? <p role="alert">Older events could not be loaded.</p> : null}
      {current.length === 0 ? (
        <p>No integrity events are available yet.</p>
      ) : (
        <>
          <p>
            Showing events {oldest}–{newest}
          </p>
          <ol aria-label="Integrity events">
            {[...current]
              .sort((a, b) => b.sequence - a.sequence)
              .map((event) => (
                <li key={event.sequence}>
                  <strong>{event.kind}</strong> ({event.category}) — {event.occurredAt}
                  {typeof event.safeMetadata.count === "number"
                    ? ` · ${event.safeMetadata.count}`
                    : null}
                  {referenceLabels.get(event.sequence)?.map((label) => (
                    <span key={label}> · {label}</span>
                  ))}
                </li>
              ))}
          </ol>
        </>
      )}
      {pages.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            setPages((previous) => previous.slice(0, -1));
            setNoOlder(false);
          }}
        >
          Newer events
        </button>
      ) : null}
      {onLoadOlder && current.length === PAGE_SIZE && !noOlder ? (
        <button type="button" disabled={loading} onClick={() => void loadOlder()}>
          Older events
        </button>
      ) : null}
    </section>
  );
}
