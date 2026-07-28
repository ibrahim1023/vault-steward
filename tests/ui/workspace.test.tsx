import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VaultStewardWorkspace } from "../../src/ui/VaultStewardWorkspace.js";

const finding = {
  schemaVersion: 1 as const,
  id: "finding",
  scanId: "scan",
  type: "broken-reference" as const,
  severity: "medium" as const,
  evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
  affectedNoteIds: ["Home.md"],
  explanation: "Missing target",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("VaultStewardWorkspace", () => {
  afterEach(cleanup);

  it("runs a scan and publishes findings through accessible live states", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding] })}
      />
    );
    const button = screen.getByRole("button", { name: "Run scan" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByText("Scanning references...")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Finding detail" })).toHaveTextContent(
        "Missing target"
      )
    );
    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
  });

  it("keeps the scan command available after a user-safe failure", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => Promise.reject(new Error("offline"))}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The scan could not complete.")
    );
    expect(screen.getByRole("button", { name: "Run scan" })).toBeEnabled();
  });

  it("distinguishes a local-model failure from unavailable vault access", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => Promise.reject(new Error("required model provider is unavailable"))}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Model analysis did not complete. Check the configured provider and model."
      )
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("Vault access is unavailable")).not.toBeInTheDocument();
  });

  it("distinguishes a structured-output failure from an unavailable provider", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => Promise.reject(new Error("required model output could not be validated"))}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Model output could not be validated")
    );
  });

  it("shows a compact finding queue with the highest-priority detail selected by default", async () => {
    const findings = [
      {
        ...finding,
        id: "critical",
        severity: "critical" as const,
        explanation: "Critical finding"
      },
      { ...finding, id: "high", severity: "high" as const, explanation: "High finding" },
      { ...finding, id: "medium", severity: "medium" as const, explanation: "Medium finding" },
      { ...finding, id: "low", severity: "low" as const, explanation: "Low finding" }
    ];
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings })}
        loadFindings={() => findings}
      />
    );

    const priorityFindings = within(screen.getByRole("region", { name: "Priority findings" }));
    await waitFor(() =>
      expect(
        priorityFindings.getByRole("button", { name: /critical finding/i })
      ).toBeInTheDocument()
    );
    expect(priorityFindings.getAllByRole("button", { name: /finding:/i })).toHaveLength(3);
    expect(priorityFindings.queryByRole("button", { name: /low finding/i })).toBeNull();
    expect(screen.getByRole("region", { name: "Finding detail" })).toHaveTextContent(
      "Critical finding"
    );

    fireEvent.click(priorityFindings.getByRole("button", { name: "View all findings" }));
    expect(priorityFindings.getByRole("button", { name: /low finding/i })).toBeInTheDocument();
  });

  it("resets hidden queue filters when returning to the compact queue", async () => {
    const findings = [
      {
        ...finding,
        id: "critical",
        severity: "critical" as const,
        explanation: "Critical finding"
      },
      { ...finding, id: "high", severity: "high" as const, explanation: "High finding" },
      { ...finding, id: "medium", severity: "medium" as const, explanation: "Medium finding" },
      { ...finding, id: "low", severity: "low" as const, explanation: "Low finding" }
    ];
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings })}
        loadFindings={() => findings}
      />
    );

    const priorityFindings = within(screen.getByRole("region", { name: "Priority findings" }));
    await waitFor(() =>
      expect(priorityFindings.getByRole("button", { name: /critical finding/i })).toBeEnabled()
    );
    fireEvent.click(priorityFindings.getByRole("button", { name: "View all findings" }));
    fireEvent.change(priorityFindings.getByLabelText("Finding severity filter"), {
      target: { value: "low" }
    });
    fireEvent.change(priorityFindings.getByLabelText("Search findings"), {
      target: { value: "low" }
    });
    expect(priorityFindings.getAllByRole("button", { name: /finding:/i })).toHaveLength(1);

    fireEvent.click(priorityFindings.getByRole("button", { name: "Show priority findings" }));

    expect(priorityFindings.getAllByRole("button", { name: /finding:/i })).toHaveLength(3);
    expect(priorityFindings.getByRole("button", { name: /critical finding/i })).toBeInTheDocument();
    expect(priorityFindings.queryByRole("button", { name: /low finding/i })).toBeNull();

    fireEvent.click(priorityFindings.getByRole("button", { name: "View all findings" }));
    expect(priorityFindings.getByLabelText("Finding severity filter")).toHaveValue("all");
    expect(priorityFindings.getByLabelText("Search findings")).toHaveValue("");
  });

  it("selects the intended broken reference before preparing a repair", async () => {
    const secondFinding = {
      ...finding,
      id: "second-finding",
      explanation: "Old target needs repair",
      evidence: [{ notePath: "Home.md", locator: "line:2", excerpt: "[[Old Target]]" }]
    };
    let selectedId: string | undefined;
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding, secondFinding] })}
        loadFindings={() => [finding, secondFinding]}
        createProposal={async (findingId) => {
          selectedId = findingId;
          throw new Error("stop after selection");
        }}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /old target needs repair/i })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /old target needs repair/i }));
    expect(screen.queryByLabelText("Reference target")).toBeNull();
    const reviewRepair = screen.getByRole("button", { name: "Review repair" });
    expect(reviewRepair).toHaveAttribute("aria-expanded", "false");
    expect(reviewRepair).toHaveAttribute("aria-controls", "reference-repair-setup");
    fireEvent.click(reviewRepair);
    expect(reviewRepair).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Reference target")).toHaveAttribute(
      "id",
      "reference-repair-target"
    );
    expect(
      screen.getByLabelText("Reference target").closest("#reference-repair-setup")
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Reference target"), {
      target: { value: "Vault Steward Test/Target" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare reference repair" }));

    await waitFor(() => expect(selectedId).toBe("second-finding"));
    expect(screen.getByRole("alert")).toHaveTextContent("stop after selection");
  });

  it("closes repair setup when the selected finding changes", async () => {
    const secondFinding = {
      ...finding,
      id: "second-finding",
      explanation: "Second target needs repair"
    };
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [finding, secondFinding] })}
        loadFindings={() => [finding, secondFinding]}
        createProposal={async () => {
          throw new Error("not used");
        }}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Review repair" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Review repair" }));
    expect(screen.getByLabelText("Reference target")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /second target needs repair/i }));
    expect(screen.queryByLabelText("Reference target")).toBeNull();
  });

  it("uses keyboard-native controls and announces scan state without exposing mutation", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="A deliberately long vault name for a narrow Obsidian pane"
        scan={async () => ({ scanId: "scan", findings: [finding] })}
      />
    );

    const command = screen.getByRole("button", { name: "Run scan" });
    command.focus();
    expect(command).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Ready to scan");
    expect(screen.queryByRole("button", { name: /approve|apply|dismiss|defer/i })).toBeNull();
  });

  it("keeps optional finding actions collapsed and explains when no automatic fix is safe", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [{ ...finding, type: "task" }] })}
        loadFindings={() => [{ ...finding, type: "task" }]}
        explainFinding={async () => ({ ok: true, text: "Evidence", latencyMs: 1 })}
        submitFeedback={async () => undefined}
      />
    );
    await waitFor(() =>
      expect(
        screen.getByText("No safe automatic fix is available for this finding.")
      ).toBeInTheDocument()
    );
    expect(screen.getByText("Explain evidence").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Review feedback").closest("details")).not.toHaveAttribute("open");
  });

  it("orders advanced tools with model readiness before Policy Studio", async () => {
    render(
      <VaultStewardWorkspace
        vaultLabel="Test vault"
        scan={async () => ({ scanId: "scan", findings: [] })}
        checkModelReadiness={async () => {
          throw new Error("not used");
        }}
        policyStudio={{
          loadDraft: async () => "",
          previewDraft: async () => ({ ok: false, diagnostics: ["not used"] }),
          saveDraft: async () => undefined
        }}
      />
    );

    const more = screen.getByText("More").closest("details");
    expect(more).not.toBeNull();
    const content = more!.querySelector(".more-tools-content");
    expect(content).not.toBeNull();
    const model = within(content as HTMLElement).getByRole("region", { name: "Model readiness" });
    const policy = await within(content as HTMLElement).findByRole("region", {
      name: "Policy Studio"
    });

    expect(model.compareDocumentPosition(policy) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });
});
