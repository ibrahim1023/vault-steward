import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryView } from "../../src/ui/HistoryView.js";

describe("HistoryView", () => {
  it("renders scan and recurrence metadata without note content", () => {
    render(
      <HistoryView
        scans={[
          { id: "scan-1", startedAt: "2026-07-15", finishedAt: "2026-07-15", status: "completed" }
        ]}
        lifecycle={[
          {
            type: "broken-reference",
            severity: "medium",
            evidenceJson: "[redacted]",
            firstSeen: "2026-07-14",
            lastSeen: "2026-07-15",
            occurrences: 2,
            resolved: false,
            stale: false
          }
        ]}
      />
    );
    expect(screen.getByRole("region", { name: "Vault history" })).toHaveTextContent(
      "occurrences 2"
    );
    expect(screen.queryByText("[redacted]")).toBeNull();
  });
});
