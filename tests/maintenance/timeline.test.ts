import { describe, expect, it } from "vitest";

import type { IntegrityEvent } from "../../src/contracts/integrity-event.js";
import { exportIntegrityTimeline } from "../../src/maintenance/timeline.js";

const event: IntegrityEvent = {
  schemaVersion: 1,
  sequence: 1,
  id: "event-1",
  category: "review",
  kind: "finding-changed",
  occurredAt: "2026-09-29T00:00:00.000Z",
  scanId: "scan-1",
  stableKey: `finding:v1:${"a".repeat(64)}`,
  occurrenceId: `occurrence:v1:${"b".repeat(64)}`,
  safeMetadata: { count: 2 }
};

describe("integrity Timeline export", () => {
  it("exports only validated safe fields and omits identifiers even if a caller passes a path-like id", () => {
    const output = exportIntegrityTimeline([{ ...event, id: "Private/Diary.md" }]);
    expect(JSON.parse(output)).toEqual({
      schemaVersion: 1,
      events: [
        {
          sequence: 1,
          category: "review",
          kind: "finding-changed",
          occurredAt: event.occurredAt,
          safeMetadata: { count: 2 }
        }
      ]
    });
    expect(output).not.toContain("Private/Diary.md");
    expect(output).not.toContain(event.stableKey);
    expect(output).not.toContain("scan-1");
  });

  it("redacts string metadata even when stored model identifiers resemble vault paths", () => {
    const output = exportIntegrityTimeline([
      {
        ...event,
        category: "operational",
        kind: "provider-ready",
        safeMetadata: { provider: "ollama", model: "Private/Diary.md", retryCount: 1 }
      }
    ]);
    expect(JSON.parse(output).events[0].safeMetadata).toEqual({ retryCount: 1 });
    expect(output).not.toContain("Private/Diary.md");
  });

  it("rejects unknown metadata fields and too many events", () => {
    expect(() =>
      exportIntegrityTimeline([{ ...event, safeMetadata: { notePath: "Home.md" } }])
    ).toThrow();
    expect(() =>
      exportIntegrityTimeline(
        Array.from({ length: 501 }, (_, index) => ({
          ...event,
          sequence: index + 1,
          id: `event-${index}`
        }))
      )
    ).toThrow("limit");
  });
});
