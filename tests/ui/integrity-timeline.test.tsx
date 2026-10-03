import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IntegrityEvent } from "../../src/contracts/integrity-event.js";
import { IntegrityTimeline } from "../../src/ui/IntegrityTimeline.js";

afterEach(cleanup);

const event: IntegrityEvent = {
  schemaVersion: 1,
  sequence: 8,
  id: "event-8",
  category: "review",
  kind: "finding-recurred",
  occurredAt: "2026-09-29T00:00:00.000Z",
  scanId: "scan-1",
  stableKey: `finding:v1:${"a".repeat(64)}`,
  safeMetadata: { count: 2 }
};

describe("IntegrityTimeline", () => {
  it("shows ordered event metadata, not diagnostic traces or identifiers, and exports only on click", async () => {
    const onExport = vi.fn(async () => undefined);
    render(
      <IntegrityTimeline
        events={[{ ...event, sequence: 7, id: "event-7", kind: "finding-opened" }, event]}
        onExport={onExport}
      />
    );
    const region = screen.getByRole("region", { name: "Integrity Timeline" });
    expect(region).toHaveTextContent("finding-recurred");
    expect(region).toHaveTextContent("finding-opened");
    expect(region).not.toHaveTextContent(event.stableKey!);
    expect(region).not.toHaveTextContent("trace-span");
    expect(onExport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Export redacted Timeline" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("copied");
  });

  it("groups events by canonical references without revealing path-like identifiers", () => {
    const related: IntegrityEvent[] = [
      {
        schemaVersion: 1,
        sequence: 9,
        id: "evt-9",
        category: "audit",
        kind: "apply-started",
        occurredAt: event.occurredAt,
        proposalId: "Private/Diary.md",
        safeMetadata: {}
      },
      {
        schemaVersion: 1,
        sequence: 10,
        id: "evt-10",
        category: "audit",
        kind: "apply-succeeded",
        occurredAt: event.occurredAt,
        proposalId: "Private/Diary.md",
        safeMetadata: {}
      }
    ];
    render(<IntegrityTimeline events={related} onExport={async () => undefined} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Proposal 1");
    expect(rows[1]).toHaveTextContent("Proposal 1");
    expect(screen.getByRole("region", { name: "Integrity Timeline" })).not.toHaveTextContent(
      "Private/Diary.md"
    );
  });

  it("pages through older retained events and exports only the visible page", async () => {
    const newer = Array.from({ length: 100 }, (_, index) => ({
      ...event,
      id: `evt-${index + 101}`,
      sequence: index + 101
    }));
    const older = Array.from({ length: 100 }, (_, index) => ({
      ...event,
      id: `evt-${index + 1}`,
      sequence: index + 1
    }));
    const onLoadOlder = vi.fn(async () => older);
    const onExport = vi.fn(async () => undefined);
    render(<IntegrityTimeline events={newer} onLoadOlder={onLoadOlder} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Older events" }));
    await waitFor(() => expect(onLoadOlder).toHaveBeenCalledWith(101));
    expect(screen.getByText("Showing events 1–100")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export redacted Timeline" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith(older));
    fireEvent.click(screen.getByRole("button", { name: "Newer events" }));
    expect(screen.getByText("Showing events 101–200")).toBeInTheDocument();
  });

  it("renders an empty state and reports export failure without leaking details", async () => {
    render(
      <IntegrityTimeline
        events={[]}
        onExport={async () => {
          throw new Error("Private/Diary.md");
        }}
      />
    );
    expect(screen.getByRole("region", { name: "Integrity Timeline" })).toHaveTextContent(
      "No integrity events"
    );
    fireEvent.click(screen.getByRole("button", { name: "Export redacted Timeline" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("could not be exported")
    );
    expect(screen.queryByText("Private/Diary.md")).toBeNull();
  });
});
