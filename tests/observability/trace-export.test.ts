import { describe, expect, it } from "vitest";

import { createTraceExport } from "../../src/observability/trace-export.js";
import type { ObservabilitySnapshot } from "../../src/storage/repositories.js";

const snapshot: ObservabilitySnapshot = {
  scanId: "scan-1",
  timeline: [
    {
      id: "root",
      parentSpanId: null,
      kind: "governed-scan",
      startedAt: "2026-07-29T00:00:00.000Z",
      completedAt: "2026-07-29T00:00:01.000Z",
      outcome: "success" as const,
      durationMs: 1000,
      retryCount: 0,
      fileCount: 1,
      errorCode: null,
      attributes: { fileCount: 1 }
    },
    {
      id: "parser",
      parentSpanId: "root",
      kind: "parser",
      startedAt: "2026-07-29T00:00:00.000Z",
      completedAt: "2026-07-29T00:00:01.000Z",
      outcome: "success" as const,
      durationMs: 1000,
      retryCount: 0,
      fileCount: null,
      errorCode: null,
      attributes: { parseProductCount: 1 }
    }
  ],
  lineage: [],
  snapshots: [],
  configuration: { fingerprint: "a".repeat(64), values: { model: "local-model" } },
  inventory: {
    spans: 2,
    agentExecutions: 0,
    findingLineage: 0,
    retentionDays: 30,
    categories: {
      promptSnapshots: { enabled: false, count: 0, bytes: 0 },
      modelOutputSnapshots: { enabled: false, count: 0, bytes: 0 }
    }
  },
  metrics: {
    scanDurationMs: 1,
    agentDurationMs: 0,
    p50ScanDurationMs: 1,
    p95ScanDurationMs: 1,
    parseFailures: 0,
    indexFailures: 0,
    retrievalFailures: 0,
    validationFailures: 0,
    cacheHitRate: null,
    queueDepth: 0,
    databaseBytes: 1,
    modelLoadTimeMs: null,
    tokenUsage: 0,
    retries: 0,
    incompleteRate: 0,
    staleProposals: 0,
    applyFailures: 0
  }
};

describe("trace export", () => {
  it("exports only validated metadata while preserving trace hierarchy", () => {
    const exported = createTraceExport(snapshot, "2026-07-29T01:00:00.000Z");
    expect(exported.timeline[1]).toMatchObject({ parentSpanId: "root", kind: "parser" });
    expect(JSON.stringify(exported)).not.toMatch(/note body|\/Users\//i);
  });

  it("rejects an incomplete hierarchy", () => {
    expect(() =>
      createTraceExport(
        { ...snapshot, timeline: [{ ...snapshot.timeline[0]!, parentSpanId: "missing" }] },
        "now"
      )
    ).toThrow("hierarchy");
  });
});
