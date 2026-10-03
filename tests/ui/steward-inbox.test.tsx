import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FindingV2 } from "../../src/contracts/index.js";
import { StewardInbox } from "../../src/ui/StewardInbox.js";
import type { StewardInboxItem } from "../../src/review/dispositions.js";

afterEach(cleanup);

const finding = (id: string, severity: "critical" | "medium" = "medium"): FindingV2 => ({
  schemaVersion: 2,
  id,
  scanId: "scan-1",
  type: "broken-reference",
  severity,
  evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Secret]]" }],
  affectedNoteIds: ["Home.md"],
  explanation: `Missing target ${id}`,
  suggestedFixes: [{ description: "Repair" }],
  confidence: 1,
  status: "open",
  identity: {
    schemaVersion: 1,
    identityVersion: 1,
    stableKey: `finding:v1:${"a".repeat(64)}`,
    family: "broken-reference",
    subtype: "missing",
    detectorId: "reference",
    detectorVersion: "1",
    subjectIds: ["subject-a"],
    semanticKey: id
  },
  stableKey: `finding:v1:${"a".repeat(64)}`,
  occurrenceId: `occurrence:v1:${"b".repeat(64)}`,
  evidenceRevisionKey: `evidence:v1:${"c".repeat(64)}`
});

const item = (id: string, severity: "critical" | "medium" = "medium"): StewardInboxItem => ({
  finding: finding(id, severity),
  occurrenceId: `occurrence-${id}`,
  disposition: null
});

describe("StewardInbox", () => {
  it("keeps critical count visible under filters and routes Review fix to preview, never apply", () => {
    const onReviewFix = vi.fn();
    const onDisposition = vi.fn();
    render(
      <StewardInbox
        snapshot={{ items: [item("critical", "critical"), item("ordinary")], criticalCount: 1 }}
        onReviewFix={onReviewFix}
        onDisposition={onDisposition}
      />
    );
    expect(screen.getByRole("region", { name: "Steward Inbox" })).toHaveTextContent("1 critical");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter Inbox" }), {
      target: { value: "snoozed" }
    });
    expect(screen.getByRole("region", { name: "Steward Inbox" })).toHaveTextContent("1 critical");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter Inbox" }), {
      target: { value: "all" }
    });
    const row = screen.getByRole("listitem", { name: "Missing target critical" });
    fireEvent.click(within(row).getByRole("button", { name: "Review fix" }));
    expect(onReviewFix).toHaveBeenCalledWith(expect.objectContaining({ id: "critical" }));
    expect(onDisposition).not.toHaveBeenCalled();
  });

  it("offers Review fix for a repairable task even without suggested-fix prose", () => {
    const task = item("task");
    const onReviewFix = vi.fn();
    render(
      <StewardInbox
        snapshot={{
          items: [
            {
              ...task,
              finding: { ...task.finding, type: "task", suggestedFixes: [] }
            }
          ],
          criticalCount: 0
        }}
        onDisposition={vi.fn()}
        onReviewFix={onReviewFix}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Review fix" }));
    expect(onReviewFix).toHaveBeenCalledWith(expect.objectContaining({ type: "task" }));
  });

  it("offers a dated snooze in addition to until-evidence-changes", () => {
    const onDisposition = vi.fn();
    render(
      <StewardInbox
        snapshot={{ items: [item("one")], criticalCount: 0 }}
        onDisposition={onDisposition}
      />
    );
    fireEvent.change(screen.getByLabelText("Snooze until"), {
      target: { value: "2030-09-30T12:00" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Snooze until date" }));
    expect(onDisposition).toHaveBeenCalledWith(["occurrence-one"], "snoozed", {
      untilAt: new Date("2030-09-30T12:00").toISOString()
    });
  });

  it("selects individual occurrences with exact bulk counts and no implicit vault writes", () => {
    const onDisposition = vi.fn();
    render(
      <StewardInbox
        snapshot={{ items: [item("one"), item("two")], criticalCount: 0 }}
        onDisposition={onDisposition}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Missing target one" }));
    expect(screen.getByRole("button", { name: "Acknowledge selected (1)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Missing target two" }));
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge selected (2)" }));
    expect(onDisposition).toHaveBeenCalledWith(
      ["occurrence-one", "occurrence-two"],
      "acknowledged",
      undefined
    );
  });
});
