import { describe, expect, it } from "vitest";

import { planIncrementalScan } from "../../src/indexing/plan.js";

describe("incremental scan planner", () => {
  it("deduplicates modified paths into a sorted bounded incremental plan", () => {
    expect(
      planIncrementalScan(
        [
          { schemaVersion: 1, kind: "modify", path: "B.md" },
          { schemaVersion: 1, kind: "modify", path: "A.md" },
          { schemaVersion: 1, kind: "modify", path: "A.md" }
        ],
        { maxEvents: 50 }
      )
    ).toEqual({ mode: "incremental", paths: ["A.md", "B.md"], reasons: ["modified"] });
  });

  it("falls back to a full scan for unsafe, rename, delete, or overflowed batches", () => {
    expect(
      planIncrementalScan([{ schemaVersion: 1, kind: "rename", path: "A.md" }], { maxEvents: 50 })
    ).toMatchObject({ mode: "full" });
    expect(
      planIncrementalScan([{ schemaVersion: 1, kind: "modify", path: "../A.md" }], {
        maxEvents: 50
      })
    ).toMatchObject({ mode: "full" });
    expect(
      planIncrementalScan([{ schemaVersion: 1, kind: "modify", path: "A.md" }], { maxEvents: 0 })
    ).toMatchObject({ mode: "full", reasons: ["event-overflow"] });
  });
});
