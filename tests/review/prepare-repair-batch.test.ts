import { describe, expect, it, vi } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import {
  combinePreparedRepairs,
  findPreparedRepairConflicts,
  prepareReferenceRepairBatch,
  selectPreparedRepairItems,
  type PreparedRepair
} from "../../src/review/prepare-repair-batch.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

function brokenFinding(scanId: string): Finding {
  return {
    schemaVersion: 1,
    id: "finding-1",
    scanId,
    type: "broken-reference",
    severity: "medium",
    evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Old Guide]]" }],
    affectedNoteIds: ["Home.md"],
    explanation: "The reference target is missing.",
    suggestedFixes: [],
    confidence: 1,
    status: "open"
  };
}

describe("prepared reference repair orchestration", () => {
  it("combines compatible prepared repairs into one all-member review batch", () => {
    const repair: PreparedRepair = {
      batch: {
        schemaVersion: 1 as const,
        id: "batch-a",
        scanId: "scan-1",
        proposalIds: ["proposal-a"],
        findingIds: ["finding-a"],
        outcome: {
          expectedFindingsResolved: 1,
          notesEdited: 1,
          notesCreated: 0 as const,
          notesDeleted: 0 as const,
          findingsLeftUnchanged: 0
        }
      },
      proposals: [
        {
          schemaVersion: 1 as const,
          id: "proposal-a",
          findingId: "finding-a",
          scanId: "scan-1",
          explanation: "Repair A",
          operations: [
            {
              kind: "replace-range" as const,
              path: "Work.md",
              sourceRevision: "revision",
              start: 0,
              end: 1,
              expected: "a",
              replacement: "b"
            }
          ]
        }
      ],
      items: [
        {
          proposalId: "proposal-a",
          findingId: "finding-a",
          sourcePath: "Work.md",
          locator: "line:1",
          currentReference: "a",
          replacementReference: "b",
          repairFamily: "task" as const,
          repairKind: "clear-abandoned",
          affectedNotes: ["Work.md"]
        }
      ]
    };
    expect(combinePreparedRepairs("scan-1", 2, [repair])).toMatchObject({
      batch: { scanId: "scan-1", findingIds: ["finding-a"] }
    });

    const proposalA = repair.proposals[0]!;
    const itemA = repair.items[0]!;
    const repairB: PreparedRepair = {
      ...repair,
      batch: {
        ...repair.batch,
        id: "batch-b",
        proposalIds: ["proposal-b"],
        findingIds: ["finding-b"]
      },
      proposals: [
        {
          ...proposalA,
          id: "proposal-b",
          findingId: "finding-b",
          operations: [{ ...proposalA.operations[0]!, path: "Other.md" }]
        }
      ],
      items: [
        {
          ...itemA,
          proposalId: "proposal-b",
          findingId: "finding-b",
          sourcePath: "Other.md",
          affectedNotes: ["Other.md"]
        }
      ]
    };
    const combined = combinePreparedRepairs("scan-1", 3, [repair, repairB])!;

    expect(selectPreparedRepairItems(combined, ["proposal-b"], 3)).toMatchObject({
      batch: {
        scanId: "scan-1",
        proposalIds: ["proposal-b"],
        findingIds: ["finding-b"],
        outcome: { expectedFindingsResolved: 1, findingsLeftUnchanged: 2 }
      }
    });
    expect(selectPreparedRepairItems(combined, [], 3)).toBeNull();
    expect(selectPreparedRepairItems(combined, ["unknown"], 3)).toBeNull();
  });

  it("identifies overlapping selected operations before approval", () => {
    const proposal = (id: string, start: number, end: number) => ({
      schemaVersion: 1 as const,
      id,
      findingId: `finding-${id}`,
      scanId: "scan-1",
      explanation: "Repair",
      operations: [
        {
          kind: "replace-range" as const,
          path: "Home.md",
          sourceRevision: "revision",
          start,
          end,
          expected: "x",
          replacement: "y"
        }
      ]
    });
    const prepared: PreparedRepair = {
      batch: {
        schemaVersion: 1,
        id: "batch-1",
        scanId: "scan-1",
        proposalIds: ["one", "two"],
        findingIds: ["finding-one", "finding-two"],
        outcome: {
          expectedFindingsResolved: 2,
          notesEdited: 1,
          notesCreated: 0,
          notesDeleted: 0,
          findingsLeftUnchanged: 0
        }
      },
      proposals: [proposal("one", 0, 4), proposal("two", 3, 6)],
      items: []
    };
    expect(findPreparedRepairConflicts(prepared, ["one", "two"])).toEqual([
      { path: "Home.md", proposalIds: ["one", "two"] }
    ]);
    expect(findPreparedRepairConflicts(prepared, ["one"])).toEqual([]);
  });

  it("persists a verified rename and derives exact preview and outcome metadata", async () => {
    const snapshot = {
      ...scanVaultFiles([
        { path: "Home.md", content: "See [[Old Guide]].", revision: "revision" },
        { path: "Guides/New Guide.md", content: "# New Guide" }
      ]),
      id: "scan-1"
    };
    const finding = brokenFinding(snapshot.id);
    const persistProposal = vi.fn();
    const selectCandidate = vi.fn();

    await expect(
      prepareReferenceRepairBatch({
        snapshot,
        findings: [finding, { ...finding, id: "other", type: "task" }],
        renames: [{ oldPath: "Old Guide.md", path: "Guides/New Guide.md" }],
        readSource: async () => ({
          content: "See [[Old Guide]].",
          revision: "revision"
        }),
        selectCandidate,
        persistProposal
      })
    ).resolves.toMatchObject({
      batch: {
        schemaVersion: 1,
        scanId: "scan-1",
        proposalIds: ["proposal:finding-1"],
        findingIds: ["finding-1"],
        outcome: {
          expectedFindingsResolved: 1,
          notesEdited: 1,
          notesCreated: 0,
          notesDeleted: 0,
          findingsLeftUnchanged: 1
        }
      },
      items: [
        {
          findingId: "finding-1",
          sourcePath: "Home.md",
          locator: "line:1",
          currentReference: "[[Old Guide]]",
          replacementReference: "[[Guides/New Guide]]",
          targetPath: "Guides/New Guide.md",
          targetStatus: "verified-rename"
        }
      ]
    });
    expect(selectCandidate).not.toHaveBeenCalled();
    expect(persistProposal).toHaveBeenCalledOnce();
  });

  it("labels a provider-ranked existing target as an AI suggestion", async () => {
    const snapshot = {
      ...scanVaultFiles([
        { path: "Home.md", content: "See [[Old Guide]].", revision: "revision" },
        {
          path: "Guides/Current Guide.md",
          content: "# Current Guide"
        }
      ]),
      id: "scan-1"
    };

    await expect(
      prepareReferenceRepairBatch({
        snapshot,
        findings: [brokenFinding(snapshot.id)],
        readSource: async () => ({
          content: "See [[Old Guide]].",
          revision: "revision"
        }),
        selectCandidate: async (request) => ({
          schemaVersion: 1,
          candidateId: request.candidates[0]!.id,
          reason: "The target declares the old title as an alias."
        }),
        persistProposal: () => undefined
      })
    ).resolves.toMatchObject({
      items: [
        {
          targetPath: "Guides/Current Guide.md",
          targetStatus: "ai-suggested"
        }
      ]
    });
  });

  it("prepares a verified rename repair for a relative Markdown link", async () => {
    const snapshot = {
      ...scanVaultFiles([
        { path: "Work/Home.md", content: "[Guide](Old%20Guide.md)", revision: "revision" },
        { path: "Guides/New Guide.md", content: "# New Guide" }
      ]),
      id: "scan-1"
    };
    const finding = {
      ...brokenFinding(snapshot.id),
      evidence: [
        {
          notePath: "Work/Home.md",
          locator: "line:1",
          excerpt: "[Guide](Old%20Guide.md)"
        }
      ],
      affectedNoteIds: ["Work/Home.md"]
    };
    const selectCandidate = vi.fn();

    await expect(
      prepareReferenceRepairBatch({
        snapshot,
        findings: [finding],
        renames: [{ oldPath: "Work/Old Guide.md", path: "Guides/New Guide.md" }],
        readSource: async () => ({ content: "[Guide](Old%20Guide.md)", revision: "revision" }),
        selectCandidate,
        persistProposal: () => undefined
      })
    ).resolves.toMatchObject({
      items: [
        {
          currentReference: "[Guide](Old%20Guide.md)",
          replacementReference: "[Guide](../Guides/New%20Guide.md)",
          targetPath: "Guides/New Guide.md",
          targetStatus: "verified-rename"
        }
      ]
    });
    expect(selectCandidate).not.toHaveBeenCalled();
  });

  it("prepares an anchor repair with exact target metadata", async () => {
    const snapshot = {
      ...scanVaultFiles([
        { path: "Home.md", content: "[[Target#Missing]]", revision: "revision" },
        { path: "Target.md", content: "# Project Plan\n" }
      ]),
      id: "scan-1"
    };
    const finding = {
      ...brokenFinding(snapshot.id),
      evidence: [
        {
          notePath: "Home.md",
          locator: "line:1",
          excerpt: "[[Target#Missing]]"
        }
      ]
    };

    await expect(
      prepareReferenceRepairBatch({
        snapshot,
        findings: [finding],
        readSource: async () => ({
          content: "[[Target#Missing]]",
          revision: "revision"
        }),
        selectCandidate: async (request) => ({
          schemaVersion: 1,
          candidateId: request.candidates[0]!.id,
          reason: "The heading is the bounded match."
        }),
        persistProposal: () => undefined
      })
    ).resolves.toMatchObject({
      items: [
        {
          repairKind: "replace-heading-anchor",
          replacementReference: "[[Target#Project Plan]]",
          targetPath: "Target.md",
          targetExists: true,
          targetAnchor: { kind: "heading", value: "Project Plan" },
          targetStatus: "ai-suggested",
          affectedNotes: ["Home.md"]
        }
      ]
    });
  });

  it("returns null when no safe repair can be prepared", async () => {
    const snapshot = {
      ...scanVaultFiles([{ path: "Home.md", content: "No reference here." }]),
      id: "scan-1"
    };
    await expect(
      prepareReferenceRepairBatch({
        snapshot,
        findings: [{ ...brokenFinding(snapshot.id), evidence: [] }],
        readSource: async () => ({ content: "", revision: "revision" }),
        selectCandidate: async () => ({ schemaVersion: 1, candidateId: null, reason: "No match" }),
        persistProposal: () => undefined
      })
    ).resolves.toBeNull();
  });
});
