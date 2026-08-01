import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import type { PreparedReferenceRepair } from "../../src/review/prepare-repair-batch.js";
import type { DuplicateEntityReview } from "../../src/review/entity-duplicate-review.js";
import { VaultStewardWorkspace } from "../../src/ui/VaultStewardWorkspace.js";

const finding: Finding = {
  schemaVersion: 1,
  id: "finding",
  scanId: "scan",
  type: "broken-reference",
  severity: "medium",
  evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
  affectedNoteIds: ["Home.md"],
  explanation: "This link points to a note that does not exist.",
  suggestedFixes: [],
  confidence: 1,
  status: "open"
};

const prepared: PreparedReferenceRepair = {
  batch: {
    schemaVersion: 1,
    id: "batch-1",
    scanId: "scan",
    proposalIds: ["proposal-1"],
    findingIds: ["finding"],
    outcome: {
      expectedFindingsResolved: 1,
      notesEdited: 1,
      notesCreated: 0,
      notesDeleted: 0,
      findingsLeftUnchanged: 2
    }
  },
  proposals: [
    {
      schemaVersion: 1,
      id: "proposal-1",
      findingId: "finding",
      scanId: "scan",
      explanation: "Repair",
      operations: [
        {
          kind: "replace-range",
          path: "Home.md",
          sourceRevision: "revision",
          start: 0,
          end: 11,
          expected: "[[Missing]]",
          replacement: "[[Target]]"
        }
      ]
    }
  ],
  items: [
    {
      proposalId: "proposal-1",
      findingId: "finding",
      sourcePath: "Home.md",
      locator: "line:1",
      currentReference: "[[Missing]]",
      replacementReference: "[[Target]]",
      repairFamily: "reference",
      repairKind: "retarget-note",
      targetPath: "Target.md",
      targetExists: true,
      targetStatus: "verified-rename",
      affectedNotes: ["Home.md"]
    }
  ]
};

const preparedTask: PreparedReferenceRepair = {
  ...prepared,
  batch: { ...prepared.batch, id: "batch-task", proposalIds: ["proposal-task"] },
  proposals: [
    {
      ...prepared.proposals[0]!,
      id: "proposal-task",
      operations: [
        {
          ...prepared.proposals[0]!.operations[0]!,
          expected: "due:2026-07-01",
          replacement: "due:2026-08-15"
        }
      ]
    }
  ],
  items: [
    {
      proposalId: "proposal-task",
      findingId: "finding",
      sourcePath: "Work.md",
      locator: "line:4",
      currentReference: "due:2026-07-01",
      replacementReference: "due:2026-08-15",
      repairFamily: "task",
      repairKind: "replace-due-date",
      targetStatus: "ai-suggested",
      affectedNotes: ["Work.md"]
    }
  ]
};

const duplicateFinding: Finding = {
  ...finding,
  id: "duplicate-finding",
  type: "entity-alias",
  affectedNoteIds: ["People/Ada Lovelace.md", "People/Ada L.md"],
  evidence: [
    { notePath: "People/Ada Lovelace.md", locator: "line:1", excerpt: "Ada Lovelace" },
    { notePath: "People/Ada L.md", locator: "line:1", excerpt: "Ada L" }
  ],
  explanation: "These notes may describe the same person."
};

const duplicateReview: DuplicateEntityReview = {
  schemaVersion: 1,
  scanId: "scan",
  findingId: "duplicate-finding",
  notes: [
    {
      path: "People/Ada Lovelace.md",
      title: "Ada Lovelace",
      aliases: ["Ada"],
      backlinks: [{ sourcePath: "Research.md", locator: "line:1", excerpt: "[[Ada Lovelace]]" }]
    },
    {
      path: "People/Ada L.md",
      title: "Ada L",
      aliases: ["Ada", "A. Lovelace"],
      backlinks: [{ sourcePath: "Research.md", locator: "line:2", excerpt: "[[Ada L]]" }]
    }
  ],
  citedEvidence: duplicateFinding.evidence as [
    Finding["evidence"][number],
    Finding["evidence"][number]
  ],
  sharedAliases: ["Ada"],
  conflictingMetadata: [{ field: "role", left: "research", right: "engineering" }]
};

describe("VaultStewardWorkspace", () => {
  afterEach(cleanup);

  it("starts with one dominant action and separates utilities from Diagnostics", () => {
    const openProviderSettings = vi.fn();
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [] })}
        openProviderSettings={openProviderSettings}
        loadHistory={() => ({ scans: [], lifecycle: [] })}
        checkModelReadiness={async () => {
          throw new Error("not used");
        }}
      />
    );

    expect(screen.getByRole("button", { name: "Check vault" })).toBeEnabled();
    expect(screen.queryByText("Vault health")).not.toBeInTheDocument();
    expect(screen.queryByText("Priority findings")).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
    expect(screen.getByText("History").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Diagnostics").closest("details")).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(openProviderSettings).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("History"));
    expect(screen.getByText("No completed scan history is available.")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics").closest("details")).not.toHaveAttribute("open");
  });

  it("checks the vault and shows an exact prepared result", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding] })}
        loadFindings={() => [finding]}
        prepareRepairs={async () => prepared}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(screen.getByRole("button", { name: "Check vault" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your vault");

    const recommendation = await screen.findByRole("region", { name: "Prepared result" });
    expect(within(recommendation).getByText("Current")).toBeInTheDocument();
    expect(within(recommendation).getByText("[[Missing]]")).toBeInTheDocument();
    expect(within(recommendation).getByText("After")).toBeInTheDocument();
    expect(within(recommendation).getByText("[[Target]]")).toBeInTheDocument();
    expect(within(recommendation).getByText("Verified rename")).toBeInTheDocument();
    expect(within(recommendation).getByText("Reference target")).toBeInTheDocument();
    const repair = within(recommendation).getByText("[[Missing]]").closest("details");
    expect(repair).not.toHaveAttribute("open");
    fireEvent.click(repair!.querySelector("summary")!);
    expect(repair).toHaveAttribute("open");
    expect(within(repair!).getByText("Existing target")).toBeInTheDocument();
    expect(within(repair!).getByText("Target.md")).toBeInTheDocument();
    expect(within(recommendation).getByText("Expected result")).toBeInTheDocument();
    expect(within(recommendation).getByText("1 issue resolved")).toBeInTheDocument();
    expect(within(recommendation).getByText("1 note edited")).toBeInTheDocument();
    expect(within(recommendation).getByRole("button", { name: "Apply 1 fix" })).toBeEnabled();
  });

  it("labels task repair previews without reference-only language", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding] })}
        loadFindings={() => [finding]}
        prepareRepairs={async () => preparedTask}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByText("Bounded task repair")).toBeInTheDocument();
    expect(screen.getByText("Due date")).toBeInTheDocument();
    expect(screen.queryByText("Target check")).not.toBeInTheDocument();
  });

  it("keeps the review loop usable when AI analysis has an invalid response", async () => {
    const taskFinding = {
      ...finding,
      id: "task-with-limited-ai",
      type: "task" as const,
      explanation: "A deterministic task check still needs review."
    };
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({
          scanId: "scan",
          findings: [taskFinding],
          limitations: ["local-model-output-unavailable"]
        })}
        loadFindings={() => [taskFinding]}
        prepareRepairs={async () => null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));

    expect(await screen.findByText(taskFinding.explanation)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("AI review was incomplete");
  });

  it("shows a safe side-by-side comparison for a possible duplicate", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [duplicateFinding] })}
        loadFindings={() => [duplicateFinding]}
        prepareRepairs={async () => null}
        loadDuplicateEntityReview={() => duplicateReview}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));

    const review = await screen.findByRole("region", { name: "Possible duplicate review" });
    expect(within(review).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(within(review).getByText("Ada L")).toBeInTheDocument();
    expect(within(review).getByText("Shared aliases:")).toBeInTheDocument();
    expect(
      within(review).getByText("No notes will be combined, deleted, or changed from this review.")
    ).toBeInTheDocument();
    const evidence = within(review).getByText("View cited overlap").closest("details");
    expect(evidence).not.toHaveAttribute("open");
    fireEvent.click(evidence!.querySelector("summary")!);
    expect(evidence).toHaveAttribute("open");
    expect(within(evidence!).getByText("People/Ada Lovelace.md")).toBeInTheDocument();
    const conflicts = within(review)
      .getByText("Compare conflicting metadata (1)")
      .closest("details");
    expect(conflicts).not.toHaveAttribute("open");
    fireEvent.click(conflicts!.querySelector("summary")!);
    expect(conflicts).toHaveAttribute("open");
    expect(
      within(review).getByText(
        (_, element) =>
          element?.tagName === "DD" && element.textContent?.includes("research") === true
      )
    ).toHaveTextContent("engineering");
  });

  it("uses one Apply click as approval and reports the actual result", async () => {
    let resolveApply:
      | ((value: {
          ok: true;
          appliedProposalIds: string[];
          skippedProposalIds: string[];
          failedProposalIds: string[];
          notesEdited: number;
          reindexed: boolean;
        }) => void)
      | undefined;
    const applyRepairs = vi.fn(
      () =>
        new Promise<{
          ok: true;
          appliedProposalIds: string[];
          skippedProposalIds: string[];
          failedProposalIds: string[];
          notesEdited: number;
          reindexed: boolean;
        }>((resolve) => {
          resolveApply = resolve;
        })
    );
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding] })}
        loadFindings={() => [finding]}
        prepareRepairs={async () => prepared}
        applyRepairs={applyRepairs}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    const apply = await screen.findByRole("button", { name: "Apply 1 fix" });
    fireEvent.click(apply);
    expect(apply).toBeDisabled();
    expect(apply).toHaveAttribute("aria-busy", "true");
    expect(apply).toHaveTextContent("Applying 1 fix...");
    expect(screen.getByRole("status")).toHaveTextContent("Applying approved fixes");
    expect(applyRepairs).toHaveBeenCalledOnce();

    resolveApply?.({
      ok: true,
      appliedProposalIds: ["proposal-1"],
      skippedProposalIds: [],
      failedProposalIds: [],
      notesEdited: 1,
      reindexed: true
    });
    expect(await screen.findByText("Your vault is updated")).toBeInTheDocument();
    expect(screen.getByText("1 fix applied")).toBeInTheDocument();
    expect(screen.getByText("1 note changed")).toBeInTheDocument();
    expect(screen.getByText("Vault checked again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review next issue" })).toBeEnabled();
  });

  it("shows one actionable recovery message when the prepared batch is stale", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding] })}
        loadFindings={() => [finding]}
        prepareRepairs={async () => prepared}
        applyRepairs={async () => ({
          ok: false,
          reason: "stale",
          appliedProposalIds: [],
          skippedProposalIds: ["proposal-1"],
          failedProposalIds: [],
          notesEdited: 0,
          reindexed: false
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply 1 fix" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A note changed after this preview. Check the vault again."
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Check vault again" })).toBeEnabled();
  });

  it("shows one concrete action for a finding without a safe repair", async () => {
    const taskFinding = {
      ...finding,
      id: "task",
      type: "task" as const,
      explanation: "This overdue launch task needs an owner decision."
    };
    const openNote = vi.fn();
    const markNotImportant = vi.fn(async () => undefined);
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [taskFinding] })}
        loadFindings={() => [taskFinding]}
        prepareRepairs={async () => null}
        openNote={openNote}
        markNotImportant={markNotImportant}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByText(taskFinding.explanation)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open note" }));
    expect(openNote).toHaveBeenCalledWith("Home.md");
    fireEvent.click(screen.getByRole("button", { name: "Not important" }));
    expect(markNotImportant).toHaveBeenCalledWith(taskFinding);
    expect(await screen.findByText("Your vault looks clear")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("advances through multiple locally dismissed judgment findings", async () => {
    const firstTask = {
      ...finding,
      id: "task-1",
      type: "task" as const,
      explanation: "The first task needs review."
    };
    const secondTask = {
      ...finding,
      id: "task-2",
      type: "task" as const,
      explanation: "The second task needs review."
    };
    const thirdTask = {
      ...finding,
      id: "task-3",
      type: "task" as const,
      explanation: "The third task needs review."
    };
    const markNotImportant = vi.fn(async () => undefined);
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [firstTask, secondTask, thirdTask] })}
        loadFindings={() => [firstTask, secondTask, thirdTask]}
        prepareRepairs={async () => null}
        markNotImportant={markNotImportant}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByText(firstTask.explanation)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not important" }));
    expect(await screen.findByText(secondTask.explanation)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not important" }));
    expect(await screen.findByText(thirdTask.explanation)).toBeInTheDocument();
    expect(markNotImportant).toHaveBeenNthCalledWith(1, firstTask);
    expect(markNotImportant).toHaveBeenNthCalledWith(2, secondTask);
  });

  it("advances immediately without waiting for another repair recommendation", async () => {
    const firstTask = {
      ...finding,
      id: "task-1",
      type: "task" as const,
      explanation: "The first task needs review."
    };
    const secondTask = {
      ...finding,
      id: "task-2",
      type: "task" as const,
      explanation: "The second task needs review."
    };
    const prepareRepairs = vi
      .fn<() => Promise<PreparedReferenceRepair | null>>()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise<null>(() => undefined));
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [firstTask, secondTask] })}
        loadFindings={() => [firstTask, secondTask]}
        prepareRepairs={prepareRepairs}
        markNotImportant={async () => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByText(firstTask.explanation)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not important" }));
    expect(await screen.findByText(secondTask.explanation)).toBeInTheDocument();
    expect(prepareRepairs).toHaveBeenCalledOnce();
  });

  it("continues to the next judgment when repair preparation is unavailable", async () => {
    const firstTask = {
      ...finding,
      id: "task-1",
      type: "task" as const,
      explanation: "The first task needs review."
    };
    const secondTask = {
      ...finding,
      id: "task-2",
      type: "task" as const,
      explanation: "The second task needs review."
    };
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [firstTask, secondTask] })}
        loadFindings={() => [firstTask, secondTask]}
        prepareRepairs={async () => {
          throw new Error("provider selection timed out");
        }}
        markNotImportant={async () => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByText(firstTask.explanation)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not important" }));
    expect(await screen.findByText(secondTask.explanation)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("runs a fresh scan when checking a clear vault again", async () => {
    const scan = vi.fn(async () => ({ scanId: "scan", findings: [] }));
    render(<VaultStewardWorkspace vaultLabel="Test vault" scan={scan} />);

    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByText("Your vault looks clear")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() => expect(scan).toHaveBeenCalledTimes(2));
  });

  it("preserves the last successful issue list after a provider failure", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => Promise.reject(new Error("required model provider is unavailable"))}
        loadFindings={() => [finding]}
      />
    );

    await waitFor(() => expect(screen.getByText("View all issues (1)")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Check vault" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Model analysis did not complete. Check the configured provider and model."
    );
    fireEvent.click(screen.getByText("View all issues (1)"));
    expect(screen.getByText(finding.explanation)).toBeInTheDocument();
  });
});
