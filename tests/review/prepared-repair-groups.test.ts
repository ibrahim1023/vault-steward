import { describe, expect, it } from "vitest";

import type { PreparedRepairItem } from "../../src/review/prepare-repair-batch.js";
import { groupPreparedRepairItems } from "../../src/review/prepared-repair-groups.js";

const item = (overrides: Partial<PreparedRepairItem>): PreparedRepairItem => ({
  proposalId: "proposal-a",
  findingId: "finding-a",
  sourcePath: "Projects/Northstar/Plan.md",
  locator: "line:4",
  currentReference: "[[Old]]",
  replacementReference: "[[New]]",
  repairFamily: "reference",
  repairKind: "retarget-note",
  affectedNotes: ["Projects/Northstar/Plan.md"],
  ...overrides
});

describe("prepared repair groups", () => {
  it("groups only compatible fixes by family, folder, and affected notes", () => {
    const groups = groupPreparedRepairItems([
      item({ proposalId: "proposal-a" }),
      item({ proposalId: "proposal-b", findingId: "finding-b" }),
      item({
        proposalId: "proposal-c",
        findingId: "finding-c",
        repairFamily: "task",
        repairKind: "replace-due-date"
      }),
      item({
        proposalId: "proposal-d",
        findingId: "finding-d",
        sourcePath: "Guides/Plan.md",
        affectedNotes: ["Guides/Plan.md"]
      })
    ]);

    expect(groups).toHaveLength(3);
    expect(
      groups.find((group) => group.label === "Reference fixes in Projects/Northstar")?.items
    ).toHaveLength(2);
    expect(groups.map((group) => group.items.flatMap((entry) => entry.proposalId))).toEqual(
      expect.arrayContaining([["proposal-a", "proposal-b"], ["proposal-c"], ["proposal-d"]])
    );
  });
});
