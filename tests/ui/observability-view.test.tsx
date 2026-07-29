import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ObservabilityView } from "../../src/ui/ObservabilityView.js";
import type { ObservabilitySnapshot } from "../../src/storage/repositories.js";

const snapshot: ObservabilitySnapshot = {
  scanId: "scan-1",
  timeline: [
    {
      id: "scan-1:scanner",
      parentSpanId: null,
      kind: "scanner",
      startedAt: "2026-07-16T00:00:00.000Z",
      completedAt: "2026-07-16T00:00:00.025Z",
      outcome: "success" as const,
      durationMs: 25,
      retryCount: 0,
      fileCount: 2,
      errorCode: null,
      attributes: { fileCount: 2 }
    }
  ],
  lineage: [
    {
      findingId: "finding-1",
      evidenceLocators: ["Tasks.md (line:3)"],
      parsedArtifactIds: ["parse:Tasks.md"],
      validatorId: "finding-normalization",
      coordinatorDecisionId: "coordinator:scan-1",
      agentExecutionId: null,
      retrievalMetadata: ["not-run"],
      policyEvaluationId: "not-run",
      proposalSourceId: "not-applicable"
    }
  ],
  configuration: { fingerprint: "a".repeat(64), values: { model: "llama3.1:8b" } },
  inventory: {
    spans: 1,
    agentExecutions: 0,
    findingLineage: 1,
    retentionDays: 30,
    categories: {
      promptSnapshots: { enabled: false, count: 0, bytes: 0 },
      modelOutputSnapshots: { enabled: false, count: 0, bytes: 0 }
    }
  },
  snapshots: [],
  metrics: {
    scanDurationMs: 25,
    agentDurationMs: 0,
    p50ScanDurationMs: 25,
    p95ScanDurationMs: 25,
    parseFailures: 0,
    indexFailures: 0,
    retrievalFailures: 0,
    validationFailures: 0,
    cacheHitRate: null,
    queueDepth: 0,
    databaseBytes: 1024,
    modelLoadTimeMs: null,
    tokenUsage: 0,
    retries: 0,
    incompleteRate: 0,
    staleProposals: 0,
    applyFailures: 0
  }
};

describe("ObservabilityView", () => {
  it("is closed by default and renders scan metadata without evidence excerpts", () => {
    render(
      <ObservabilityView
        scans={[
          {
            id: "scan-1",
            startedAt: "2026-07-16T00:00:00.000Z",
            finishedAt: null,
            status: "completed"
          }
        ]}
        loadObservability={() => snapshot}
        selectedFindingId="finding-1"
      />
    );

    const disclosure = screen.getByText("Observability").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Observability"));
    expect(screen.getByText("scanner")).toBeInTheDocument();
    expect(screen.getByText("Tasks.md (line:3)")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Operational metrics" })).toHaveTextContent(
      "Scan p50 / p95"
    );
    expect(screen.queryByText("note body content")).not.toBeInTheDocument();
  });
});
