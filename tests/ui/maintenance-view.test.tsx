import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaintenanceView } from "../../src/ui/MaintenanceView.js";

describe("MaintenanceView", () =>
  it("groups findings, offers bounded review actions, and renders read-only impact", () => {
    const openNote = vi.fn();
    const dismissFinding = vi.fn();
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
  }));
