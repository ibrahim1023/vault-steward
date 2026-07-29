import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AIDebugConsole, QualityDiagnostics } from "../../src/ui/QualityDiagnostics.js";
import type { ObservabilitySnapshot } from "../../src/storage/repositories.js";

const snapshot: ObservabilitySnapshot = { scanId: null, timeline: [], lineage: [], configuration: null, inventory: { spans: 0, agentExecutions: 0, findingLineage: 0, retentionDays: 30, categories: { promptSnapshots: { enabled: false, count: 0, bytes: 0 }, modelOutputSnapshots: { enabled: false, count: 0, bytes: 0 } } }, metrics: { scanDurationMs: null, agentDurationMs: 0, p50ScanDurationMs: null, p95ScanDurationMs: null, parseFailures: 0, indexFailures: 0, retrievalFailures: 0, validationFailures: 0, cacheHitRate: null, queueDepth: 0, databaseBytes: 0, modelLoadTimeMs: null, tokenUsage: 0, retries: 0, incompleteRate: 0, staleProposals: 0, applyFailures: 0 } };

describe("quality diagnostics", () => {
  it("shows local-only unavailable states without vault content", () => {
    render(<><QualityDiagnostics scans={[]} lifecycle={[]} snapshot={snapshot} /><AIDebugConsole snapshot={snapshot} /></>);
    fireEvent.click(screen.getByText("Evaluation and quality"));
    expect(screen.getByText("No imported local evaluation report is available.")).toBeInTheDocument();
    expect(screen.getByText("No eligible fixture replay is retained.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("AI debug console"));
    expect(screen.getByText(/cannot write notes/)).toBeInTheDocument();
    expect(screen.queryByText("note body content")).not.toBeInTheDocument();
  });
});
