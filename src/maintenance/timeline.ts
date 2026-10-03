import { parseIntegrityEvent, type IntegrityEvent } from "../contracts/integrity-event.js";

const MAX_EXPORT_EVENTS = 500;
const MAX_EXPORT_BYTES = 256 * 1024;

export function exportIntegrityTimeline(events: readonly IntegrityEvent[]): string {
  if (events.length > MAX_EXPORT_EVENTS) throw new Error("Timeline export event limit exceeded");
  const redacted = events.map((event) => {
    const parsed = parseIntegrityEvent(event);
    if (!parsed.ok) throw new Error("Timeline export contains an invalid integrity event");
    const { sequence, category, kind, occurredAt, safeMetadata } = parsed.value;
    const redactedMetadata = Object.fromEntries(
      Object.entries(safeMetadata).filter(([, value]) => typeof value !== "string")
    );
    return { sequence, category, kind, occurredAt, safeMetadata: redactedMetadata };
  });
  const output = JSON.stringify({ schemaVersion: 1, events: redacted });
  if (new TextEncoder().encode(output).length > MAX_EXPORT_BYTES) {
    throw new Error("Timeline export byte limit exceeded");
  }
  return output;
}
