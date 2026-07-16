import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MaintenanceView } from "../../src/ui/MaintenanceView.js";

describe("MaintenanceView", () =>
  it("groups findings and renders read-only impact", () => {
    render(
      <MaintenanceView
        findings={[
          {
            schemaVersion: 1,
            id: "f",
            scanId: "s",
            type: "task",
            severity: "low",
            evidence: [],
            affectedNoteIds: [],
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
      />
    );
    expect(screen.getByText("Task issue (1)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Impact path"), { target: { value: "Project.md" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect impact" }));
    expect(screen.getByText(/tasks: 1/)).toBeInTheDocument();
  }));
