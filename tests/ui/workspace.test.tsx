import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        scan={async () =>
          Promise.reject(new Error("required local model semantic analysis did not complete"))
        }
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run scan" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Local model analysis did not complete. Check Ollama and the configured model."
      )
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("Vault access is unavailable")).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Reference target"), {
      target: { value: "Vault Steward Test/Target" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare reference repair" }));

    await waitFor(() => expect(selectedId).toBe("second-finding"));
    expect(screen.getByRole("alert")).toHaveTextContent("A safe proposal could not be created.");
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
});
