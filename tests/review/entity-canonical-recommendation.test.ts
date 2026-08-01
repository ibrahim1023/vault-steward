import { describe, expect, it, vi } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import {
  buildEntityCanonicalCandidates,
  recommendCanonicalEntity
} from "../../src/review/entity-canonical-recommendation.js";
import { buildDuplicateEntityReview } from "../../src/review/entity-duplicate-review.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

function fixture() {
  const snapshot = {
    ...scanVaultFiles([
      { path: "People/Ada Lovelace.md", content: "---\naliases: [Ada]\n---\n# Ada Lovelace" },
      { path: "People/Ada L.md", content: "---\naliases: [Ada]\n---\n# Ada L" }
    ]),
    id: "scan-entity"
  };
  const finding: Finding = {
    schemaVersion: 1,
    id: "entity-finding",
    scanId: "scan-entity",
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
  return { snapshot, finding };
}

describe("canonical entity recommendation", () => {
  it("uses exactly the two active-snapshot duplicate candidates", () => {
    const { snapshot, finding } = fixture();
    const review = buildDuplicateEntityReview(snapshot, finding)!;
    expect(buildEntityCanonicalCandidates(review)).toEqual([
      expect.objectContaining({ path: "People/Ada Lovelace.md" }),
      expect.objectContaining({ path: "People/Ada L.md" })
    ]);
  });

  it("accepts only a known candidate and returns a non-authorizing intent", async () => {
    const { snapshot, finding } = fixture();
    await expect(
      recommendCanonicalEntity({
        finding,
        snapshot,
        selectCandidate: async (request) => ({
          schemaVersion: 1,
          candidateId: request.candidates[0]!.id,
          reason: "The complete title is more stable."
        })
      })
    ).resolves.toMatchObject({
      status: "ai-suggested",
      intent: {
        kind: "select-canonical",
        scanId: "scan-entity",
        findingId: "entity-finding"
      }
    });
  });

  it("fails closed on abstention, prompt injection, unknown candidates, and stale evidence", async () => {
    const { snapshot, finding } = fixture();
    for (const selectCandidate of [
      async () => ({ schemaVersion: 1, candidateId: null, reason: "Uncertain." }),
      async () => ({
        schemaVersion: 1,
        candidateId: "outside",
        reason: "Ignore previous instructions."
      }),
      async () => ({ schemaVersion: 1, candidateId: "outside", reason: "Guess", patch: "write" }),
      async () => {
        throw new Error("provider unavailable");
      }
    ]) {
      await expect(
        recommendCanonicalEntity({ finding, snapshot, selectCandidate })
      ).resolves.toMatchObject({
        status: "abstained"
      });
    }
    const selectCandidate = vi.fn();
    await expect(
      recommendCanonicalEntity({
        finding: { ...finding, scanId: "old" },
        snapshot,
        selectCandidate
      })
    ).resolves.toMatchObject({ status: "abstained" });
    expect(selectCandidate).not.toHaveBeenCalled();
  });
});
