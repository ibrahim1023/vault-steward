import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReviewerFeedbackRecord } from "../../src/storage/repositories.js";
import { DiagnosticsView, type DiagnosticsViewProps } from "../../src/ui/DiagnosticsView.js";

const defaultProps = (): DiagnosticsViewProps => ({
  checkConnection: async () => ({
    available: true,
    structuredOutput: true,
    provider: "hyperfusion",
    model: "qwen/qwen3-32b",
    timeoutMs: 30_000,
    maxResponseBytes: 65_536,
    latencyMs: 412
  }),
  maintenance: {
    schedule: {
      enabled: true,
      eventTriggered: true,
      intervalMinutes: 60,
      debounceMinutes: 5,
      maxRunsPerHour: 4,
      paused: true
    },
    state: {
      scanInProgress: false,
      runsInWindow: 0,
      lastRunAt: Date.parse("2026-08-03T12:52:00.000Z")
    },
    setPaused: vi.fn(async () => undefined)
  },
  feedbackRecords: [],
  suppressedPatterns: [],
  suppressPattern: vi.fn(async () => undefined),
  deleteDiagnosticTraces: vi.fn(async () => undefined)
});

function renderDiagnostics(overrides: Partial<DiagnosticsViewProps> = {}) {
  const props = { ...defaultProps(), ...overrides };
  render(<DiagnosticsView {...props} />);
  return props;
}

function openDiagnostics() {
  const disclosure = screen.getByText("Diagnostics").closest("details");
  expect(disclosure).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Diagnostics"));
  expect(disclosure).toHaveAttribute("open");
  return within(disclosure!);
}

describe("DiagnosticsView", () => {
  afterEach(cleanup);

  it("shows only the four approved user support sections", () => {
    renderDiagnostics();
    const diagnostics = openDiagnostics();

    expect(diagnostics.getByText("Model connection")).toBeInTheDocument();
    expect(diagnostics.getByText("Automatic checks")).toBeInTheDocument();
    expect(diagnostics.getByText("Review preferences")).toBeInTheDocument();
    expect(diagnostics.getByText("Local diagnostic data")).toBeInTheDocument();
    expect(diagnostics.queryByText(/response limit/i)).not.toBeInTheDocument();
    expect(diagnostics.queryByText(/timeout/i)).not.toBeInTheDocument();
    expect(diagnostics.queryByText("Policy Studio")).not.toBeInTheDocument();
    expect(diagnostics.queryByText("Observability")).not.toBeInTheDocument();
  });

  it("reports a successful connection without technical limits", async () => {
    renderDiagnostics();
    const diagnostics = openDiagnostics();

    fireEvent.click(diagnostics.getByRole("button", { name: "Check connection" }));

    await waitFor(() =>
      expect(diagnostics.getByRole("status")).toHaveTextContent("Model ready")
    );
    expect(diagnostics.getByRole("status")).toHaveTextContent("HyperFusion · qwen/qwen3-32b");
    expect(diagnostics.queryByText(/412/)).not.toBeInTheDocument();
  });

  it("shows a redacted error when the connection cannot be checked", async () => {
    renderDiagnostics({ checkConnection: async () => Promise.reject(new Error("secret")) });
    const diagnostics = openDiagnostics();

    fireEvent.click(diagnostics.getByRole("button", { name: "Check connection" }));

    expect(await diagnostics.findByRole("alert")).toHaveTextContent("Model needs attention");
    expect(diagnostics.queryByText("secret")).not.toBeInTheDocument();
  });

  it("pauses and resumes automatic checks with one action", async () => {
    const setPaused = vi.fn(async () => undefined);
    renderDiagnostics({
      maintenance: {
        schedule: {
          enabled: true,
          eventTriggered: true,
          intervalMinutes: 60,
          debounceMinutes: 5,
          maxRunsPerHour: 4,
          paused: false
        },
        state: { scanInProgress: false, runsInWindow: 0, nextRunAt: 1_785_765_600_000 },
        setPaused
      }
    });
    const diagnostics = openDiagnostics();

    fireEvent.click(diagnostics.getByRole("button", { name: "Pause" }));

    await waitFor(() => expect(setPaused).toHaveBeenCalledWith(true));
    expect(diagnostics.getByRole("button", { name: "Resume" })).toBeEnabled();
    expect(diagnostics.queryByText(/incremental|full vault check/i)).not.toBeInTheDocument();
  });

  it("offers eligible suppression without rendering its raw key", () => {
    const feedbackRecords: ReviewerFeedbackRecord[] = [1, 2, 3].map((index) => ({
      id: `feedback-${index}`,
      findingId: `finding-${index}`,
      proposalId: null,
      verdict: "false-positive",
      label: "false-positive",
      patternKey: "task:Work/Plan.md",
      createdAt: "2026-08-03T00:00:00.000Z"
    }));
    renderDiagnostics({ feedbackRecords });
    const diagnostics = openDiagnostics();

    expect(diagnostics.getByText("Repeated task issue in Work/Plan.md")).toBeInTheDocument();
    expect(diagnostics.queryByText("task:Work/Plan.md")).not.toBeInTheDocument();
    expect(diagnostics.getByRole("button", { name: "Suppress from primary review" })).toBeEnabled();
  });

  it("confirms before deleting all diagnostic traces", async () => {
    const deleteDiagnosticTraces = vi.fn(async () => undefined);
    renderDiagnostics({ deleteDiagnosticTraces });
    const diagnostics = openDiagnostics();

    fireEvent.click(diagnostics.getByRole("button", { name: "Delete diagnostic traces" }));

    expect(deleteDiagnosticTraces).not.toHaveBeenCalled();
    expect(diagnostics.getByRole("button", { name: "Confirm deletion" })).toBeEnabled();
    fireEvent.click(diagnostics.getByRole("button", { name: "Confirm deletion" }));

    await waitFor(() => expect(deleteDiagnosticTraces).toHaveBeenCalledOnce());
    expect(diagnostics.getByRole("status")).toHaveTextContent("Diagnostic traces deleted");
  });

  it("cancels trace deletion without mutating data", () => {
    const deleteDiagnosticTraces = vi.fn(async () => undefined);
    renderDiagnostics({ deleteDiagnosticTraces });
    const diagnostics = openDiagnostics();

    fireEvent.click(diagnostics.getByRole("button", { name: "Delete diagnostic traces" }));
    fireEvent.click(diagnostics.getByRole("button", { name: "Cancel" }));

    expect(deleteDiagnosticTraces).not.toHaveBeenCalled();
    expect(diagnostics.queryByRole("button", { name: "Confirm deletion" })).not.toBeInTheDocument();
  });

  it("keeps the four sections in accessible visual order", () => {
    renderDiagnostics();
    const diagnostics = openDiagnostics();

    expect(
      diagnostics.getAllByRole("region").map((section) => section.getAttribute("aria-label"))
    ).toEqual([
      "Model connection",
      "Automatic checks",
      "Review preferences",
      "Local diagnostic data"
    ]);
  });
});
