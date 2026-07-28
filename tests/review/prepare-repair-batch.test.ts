import { describe, expect, it, vi } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import { prepareReferenceRepairBatch } from "../../src/review/prepare-repair-batch.js";
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
          content: "---\naliases: [Old Guide]\n---\n# Current Guide"
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
