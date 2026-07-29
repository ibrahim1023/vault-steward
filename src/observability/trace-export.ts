import { type TraceExport, validateTraceExport } from "../contracts/trace.js";
import type { ObservabilitySnapshot } from "../storage/repositories.js";

/** Produces a metadata-only portable trace. Callers choose the download mechanism. */
export function createTraceExport(
  snapshot: ObservabilitySnapshot,
  exportedAt: string
): TraceExport {
  if (!snapshot.scanId) throw new Error("A completed scan is required to export a trace.");
  const ids = new Set(snapshot.timeline.map((span) => span.id));
  for (const span of snapshot.timeline) {
    if (span.parentSpanId !== null && !ids.has(span.parentSpanId)) {
      throw new Error("Trace hierarchy is incomplete.");
    }
  }
  const trace: TraceExport = {
    schemaVersion: 1,
    scanId: snapshot.scanId,
    exportedAt,
    timeline: snapshot.timeline.map((span) => ({
      id: span.id,
      parentSpanId: span.parentSpanId,
      kind: span.kind,
      startedAt: span.startedAt,
      completedAt: span.completedAt,
      outcome: span.outcome,
      durationMs: span.durationMs,
      retryCount: span.retryCount,
      fileCount: span.fileCount,
      errorCode: span.errorCode,
      attributes: span.attributes
    })),
    configuration: snapshot.configuration
      ? { fingerprint: snapshot.configuration.fingerprint, values: snapshot.configuration.values }
      : null
  };
  if (!validateTraceExport(trace)) throw new Error("Trace export failed privacy validation.");
  return trace;
}

export function serializeTraceExport(snapshot: ObservabilitySnapshot, exportedAt: string): string {
  return `${JSON.stringify(createTraceExport(snapshot, exportedAt), null, 2)}\n`;
}
