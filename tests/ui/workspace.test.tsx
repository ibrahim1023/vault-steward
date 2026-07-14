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
    await waitFor(() => expect(screen.getByText("Missing target")).toBeInTheDocument());
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
});
