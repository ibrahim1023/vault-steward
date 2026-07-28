import { describe, expect, it } from "vitest";

import {
  calculatePreparedRepairOutcome,
  parsePreparedRepairBatch
} from "../../src/contracts/prepared-repair.js";
import type { Proposal } from "../../src/contracts/proposal.js";

function proposal(id: string, findingId: string, path: string, scanId = "scan-1"): Proposal {
  return {
    schemaVersion: 1,
    id,
    findingId,
    scanId,
    explanation: "Repair a broken reference.",
    operations: [
      {
        kind: "replace-range",
        path,
        sourceRevision: `revision:${path}`,
        start: 0,
        end: 11,
        expected: "[[Missing]]",
        replacement: "[[Target]]"
      }
    ]
  };
}

function batch(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    id: "batch-1",
    scanId: "scan-1",
    proposalIds: ["proposal-1", "proposal-2"],
    findingIds: ["finding-1", "finding-2"],
    outcome: {
      expectedFindingsResolved: 2,
      notesEdited: 1,
      notesCreated: 0,
      notesDeleted: 0,
      findingsLeftUnchanged: 3
    },
    ...overrides
  };
}

describe("prepared repair batch contracts", () => {
  it("accepts a bounded metadata-only batch", () => {
    expect(parsePreparedRepairBatch(batch())).toEqual({
      ok: true,
      value: batch()
    });
  });

  it("rejects unknown fields, copied content, and invalid outcome counts", () => {
    expect(parsePreparedRepairBatch(batch({ noteContent: "private" }))).toMatchObject({
      ok: false,
      diagnostics: [expect.stringContaining("unknown field")]
    });
    expect(
      parsePreparedRepairBatch(
        batch({
          outcome: {
            expectedFindingsResolved: 2,
            notesEdited: 1,
            notesCreated: 1,
            notesDeleted: 0,
            findingsLeftUnchanged: -1
          }
        })
      )
    ).toMatchObject({ ok: false });
  });

  it("rejects empty, mismatched, duplicate, and oversized ID sets", () => {
    expect(parsePreparedRepairBatch(batch({ proposalIds: [], findingIds: [] }))).toMatchObject({
      ok: false
    });
    expect(parsePreparedRepairBatch(batch({ findingIds: ["finding-1"] }))).toMatchObject({
      ok: false
    });
    expect(
      parsePreparedRepairBatch(
        batch({
          proposalIds: ["proposal-1", "proposal-1"],
          findingIds: ["finding-1", "finding-2"]
        })
      )
    ).toMatchObject({ ok: false });
    expect(
      parsePreparedRepairBatch(
        batch({
          proposalIds: Array.from({ length: 21 }, (_, index) => `proposal-${index}`),
          findingIds: Array.from({ length: 21 }, (_, index) => `finding-${index}`)
        })
      )
    ).toMatchObject({ ok: false });
  });

  it("calculates deterministic outcomes using unique findings and note paths", () => {
    expect(
      calculatePreparedRepairOutcome(
        [
          proposal("proposal-1", "finding-1", "Home.md"),
          proposal("proposal-2", "finding-2", "Home.md"),
          proposal("proposal-3", "finding-3", "Other.md")
        ],
        8
      )
    ).toEqual({
      expectedFindingsResolved: 3,
      notesEdited: 2,
      notesCreated: 0,
      notesDeleted: 0,
      findingsLeftUnchanged: 5
    });
  });

  it("rejects cross-scan proposals and impossible active finding counts", () => {
    expect(() =>
      calculatePreparedRepairOutcome(
        [
          proposal("proposal-1", "finding-1", "Home.md", "scan-1"),
          proposal("proposal-2", "finding-2", "Other.md", "scan-2")
        ],
        2
      )
    ).toThrow(/same scan/i);
    expect(() =>
      calculatePreparedRepairOutcome(
        [
          proposal("proposal-1", "finding-1", "Home.md"),
          proposal("proposal-2", "finding-2", "Other.md")
        ],
        1
      )
    ).toThrow(/active finding count/i);
  });
});
