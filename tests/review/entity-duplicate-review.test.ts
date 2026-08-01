import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import { buildDuplicateEntityReview } from "../../src/review/entity-duplicate-review.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

describe("duplicate entity review", () => {
  it("builds a cited side-by-side review from exactly two active snapshot notes", () => {
    const snapshot = {
      ...scanVaultFiles([
        {
          path: "People/Ada Lovelace.md",
          content:
            "---\ntitle: Ada Lovelace\naliases: [Ada]\nrole: research\napiKey: hidden\n---\n# Ada Lovelace"
        },
        {
          path: "People/Ada L.md",
          content: "---\naliases: [Ada, A. Lovelace]\nrole: engineering\n---\n# Ada L"
        },
        { path: "Projects/Research.md", content: "[[People/Ada Lovelace]]\n[[People/Ada L]]" }
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

    expect(buildDuplicateEntityReview(snapshot, finding)).toMatchObject({
      scanId: "scan-entity",
      notes: [
        {
          path: "People/Ada Lovelace.md",
          title: "Ada Lovelace",
          aliases: ["Ada"],
          backlinks: [{ sourcePath: "Projects/Research.md" }]
        },
        {
          path: "People/Ada L.md",
          title: "Ada L",
          aliases: ["A. Lovelace", "Ada"],
          backlinks: [{ sourcePath: "Projects/Research.md" }]
        }
      ],
      sharedAliases: ["Ada"],
      conflictingMetadata: [{ field: "role", left: "research", right: "engineering" }]
    });
  });

  it("fails closed for a cross-scan or malformed entity finding", () => {
    const snapshot = scanVaultFiles([{ path: "Ada.md", content: "# Ada" }]);
    const finding: Finding = {
      schemaVersion: 1,
      id: "entity-finding",
      scanId: "other-scan",
      type: "entity-alias",
      severity: "low",
      evidence: [
        { notePath: "Ada.md", locator: "line:1", excerpt: "Ada" },
        { notePath: "Ada.md", locator: "line:1", excerpt: "Ada" }
      ],
      affectedNoteIds: ["Ada.md"],
      explanation: "Duplicate.",
      suggestedFixes: [],
      confidence: 0.8,
      status: "open"
    };
    expect(buildDuplicateEntityReview(snapshot, finding)).toBeNull();
  });
});
