import { describe, expect, it, vi } from "vitest";

import type { EntityCanonicalIntent, Finding } from "../../src/contracts/index.js";
import { buildEntityCanonicalCandidates } from "../../src/review/entity-canonical-recommendation.js";
import { buildDuplicateEntityReview } from "../../src/review/entity-duplicate-review.js";
import { prepareEntityConsolidation } from "../../src/review/entity-consolidation.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

function fixture() {
  const files = [
    {
      path: "People/Ada Lovelace.md",
      revision: "canonical",
      content: "---\naliases: [Ada]\n---\n# Ada Lovelace\n"
    },
    {
      path: "People/Ada L.md",
      revision: "duplicate",
      content: "---\naliases: [A. Lovelace, Countess]\n---\n# Ada L\n"
    },
    {
      path: "Projects/Research.md",
      revision: "research",
      content: "[[People/Ada L|lead]] and [[People/Ada L|backup]]\n![[People/Ada L#Plan]]\n"
    },
    {
      path: "Notes/History.md",
      revision: "history",
      content: "[profile](../People/Ada%20L.md)\n"
    },
    {
      path: "People/Other.md",
      revision: "other",
      content: "---\naliases: [Countess]\n---\n# Other\n"
    }
  ];
  const snapshot = { ...scanVaultFiles(files), id: "scan-entity" };
  const finding: Finding = {
    schemaVersion: 1,
    id: "entity-finding",
    scanId: snapshot.id,
    type: "entity-alias",
    severity: "low",
    evidence: [
      { notePath: "People/Ada Lovelace.md", locator: "line:1", excerpt: "Ada Lovelace" },
      { notePath: "People/Ada L.md", locator: "line:1", excerpt: "Ada L" }
    ],
    affectedNoteIds: ["People/Ada Lovelace.md", "People/Ada L.md"],
    explanation: "These notes may describe the same person.",
    suggestedFixes: [],
    confidence: 0.8,
    status: "open"
  };
  const source = new Map(files.map((file) => [file.path, file]));
  return { snapshot, finding, source };
}

function intent(
  snapshot: ReturnType<typeof fixture>["snapshot"],
  finding: Finding
): EntityCanonicalIntent {
  const review = buildDuplicateEntityReview(snapshot, finding)!;
  const candidate = buildEntityCanonicalCandidates(review).find(
    (item) => item.path === "People/Ada Lovelace.md"
  )!;
  return {
    schemaVersion: 1,
    kind: "select-canonical",
    scanId: snapshot.id,
    findingId: finding.id,
    candidateId: candidate.id
  };
}

describe("entity consolidation", () => {
  it("previews only resolved inbound links and exclusively owned aliases", async () => {
    const { snapshot, finding, source } = fixture();
    const persistProposal = vi.fn();
    const prepared = await prepareEntityConsolidation({
      snapshot,
      finding,
      intent: intent(snapshot, finding),
      activeFindingCount: 5,
      readSource: async (path) => {
        const file = source.get(path)!;
        return { content: file.content, revision: file.revision };
      },
      persistProposal
    });

    expect(prepared).toMatchObject({
      batch: {
        findingIds: ["entity-finding"],
        outcome: { expectedFindingsResolved: 0, notesEdited: 4, findingsLeftUnchanged: 5 }
      },
      items: [
        expect.objectContaining({
          sourcePath: "Projects/Research.md",
          currentReference: "[[People/Ada L|lead]]",
          replacementReference: "[[People/Ada Lovelace|lead]]"
        }),
        expect.objectContaining({
          sourcePath: "Projects/Research.md",
          currentReference: "[[People/Ada L|backup]]",
          replacementReference: "[[People/Ada Lovelace|backup]]"
        }),
        expect.objectContaining({
          sourcePath: "Projects/Research.md",
          currentReference: "![[People/Ada L#Plan]]",
          replacementReference: "![[People/Ada Lovelace#Plan]]"
        }),
        expect.objectContaining({
          sourcePath: "Notes/History.md",
          currentReference: "[profile](../People/Ada%20L.md)",
          replacementReference: "[profile](../People/Ada%20Lovelace.md)"
        }),
        expect.objectContaining({
          sourcePath: "People/Ada Lovelace.md",
          repairKind: "transfer-alias",
          replacementReference: 'aliases: ["A. Lovelace","Ada"]\n'
        }),
        expect.objectContaining({
          sourcePath: "People/Ada L.md",
          repairKind: "transfer-alias",
          replacementReference: 'aliases: ["Countess"]\n'
        })
      ]
    });
    expect(prepared?.items.some((item) => item.replacementReference.includes("Countess"))).toBe(
      true
    );
    expect(persistProposal).toHaveBeenCalledOnce();
  });

  it("fails closed for altered revisions, bad intents, and source overlap", async () => {
    const { snapshot, finding, source } = fixture();
    const readSource = async (path: string) => {
      const file = source.get(path)!;
      return {
        content: file.content,
        revision: path === "People/Ada L.md" ? "altered" : file.revision
      };
    };
    await expect(
      prepareEntityConsolidation({
        snapshot,
        finding,
        intent: { ...intent(snapshot, finding), candidateId: "outside" },
        activeFindingCount: 5,
        readSource,
        persistProposal: () => undefined
      })
    ).resolves.toBeNull();
    await expect(
      prepareEntityConsolidation({
        snapshot,
        finding,
        intent: intent(snapshot, finding),
        activeFindingCount: 5,
        readSource,
        persistProposal: () => undefined
      })
    ).resolves.toBeNull();
  });
});
