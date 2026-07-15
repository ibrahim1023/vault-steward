import { describe, expect, it } from "vitest";

import { evaluatePerformanceBudget } from "../../src/performance/budget.js";

const baseline = {
  schemaVersion: 1 as const,
  minimumFileCount: 300,
  minimumAttachmentCount: 50,
  maxFullScanMs: 10_000,
  maxIncrementalScanMs: 1_000,
  maxHeapDeltaBytes: 128 * 1024 * 1024,
  maxSqliteWriteBytes: 20 * 1024 * 1024
};

describe("performance budget", () => {
  it("accepts complete measurements inside the release thresholds", () => {
    expect(
      evaluatePerformanceBudget(baseline, {
        fileCount: 300,
        attachmentCount: 50,
        fullScanMs: 120,
        incrementalScanMs: 4,
        heapDeltaBytes: 1024,
        sqliteWriteBytes: 4096
      })
    ).toEqual([]);
  });

  it("reports each missing workload or threshold regression", () => {
    expect(
      evaluatePerformanceBudget(baseline, {
        fileCount: 1,
        attachmentCount: 0,
        fullScanMs: 20_000,
        incrementalScanMs: 2_000,
        heapDeltaBytes: 200 * 1024 * 1024,
        sqliteWriteBytes: 30 * 1024 * 1024
      })
    ).toHaveLength(6);
  });
});
