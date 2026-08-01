import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaintenanceView } from "../../src/ui/MaintenanceView.js";

describe("MaintenanceView", () =>
  it("groups findings, offers bounded review actions, and renders read-only impact", () => {
    const openNote = vi.fn();
    const dismissFinding = vi.fn();
    const prepareSupportedRepair = vi.fn(async () => true);
    render(
      <MaintenanceView
        findings={[
          {
            schemaVersion: 1,
            id: "f",
            scanId: "s",
            type: "task",
            severity: "low",
            evidence: [{ notePath: "Tasks.md", locator: "line:1", excerpt: "- [ ] Task" }],
            affectedNoteIds: ["Tasks.md"],
            explanation: "Task issue",
            suggestedFixes: [],
            confidence: 1,
            status: "open"
          }
        ]}
        inspectImpact={(path) => ({
          change: { kind: "delete", path },
          inboundReferences: [],
          aliasDependents: [],
          taskDependents: ["Task.md"],
          decisionDependents: [],
          policyDependents: [],
          affectedPaths: [],
          safeRenameTargets: []
        })}
        openNote={openNote}
        dismissFinding={dismissFinding}
        prepareSupportedRepair={prepareSupportedRepair}
      />
    );
    expect(screen.getByText("Task issue (1)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Impact path"), { target: { value: "Project.md" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect impact" }));
    expect(screen.getByText(/tasks: 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open note" }));
    expect(openNote).toHaveBeenCalledWith("Tasks.md");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss signal" }));
    expect(dismissFinding).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Prepare supported fix" })).not.toBeInTheDocument();
  }));

it("reuses the existing preparation flow only for repairable reference findings", () => {
  const prepareSupportedRepair = vi.fn(async () => true);
  render(
    <MaintenanceView
      findings={[
        {
          schemaVersion: 1,
          id: "reference",
          scanId: "scan",
          type: "broken-reference",
          severity: "medium",
          evidence: [{ notePath: "Home.md", locator: "line:2", excerpt: "[[Missing]]" }],
          affectedNoteIds: ["Home.md"],
          explanation: "The reference has a missing target.",
          suggestedFixes: [],
          confidence: 1,
          status: "open"
        }
      ]}
      inspectImpact={() => ({
        change: { kind: "delete", path: "Missing.md" },
        inboundReferences: [],
        aliasDependents: [],
        taskDependents: [],
        decisionDependents: [],
        policyDependents: [],
        affectedPaths: [],
        safeRenameTargets: []
      })}
      prepareSupportedRepair={prepareSupportedRepair}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Prepare supported fix" }));
  expect(prepareSupportedRepair).toHaveBeenCalledOnce();
});
