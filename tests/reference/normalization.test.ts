import { describe, expect, it } from "vitest";

import { buildContextualNormalizationFindings } from "../../src/reference/normalization.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

describe("context-triggered reference normalization", () => {
  it("creates findings only when multiple references resolve to an authorized canonical note", () => {
    const snapshot = {
      ...scanVaultFiles([
        { path: "One.md", content: "[[Old Guide|guide]]" },
        { path: "Work/Two.md", content: "[Guide](../Old%20Guide.md#plan)" },
        {
          path: "Guides/New Guide.md",
          content: "---\naliases: [Old Guide]\n---\n# Plan"
        },
        { path: "Unrelated.md", content: "[[Elsewhere]]" }
      ]),
      id: "scan-1"
    };

    expect(
      buildContextualNormalizationFindings(snapshot, [
        {
          schemaVersion: 1,
          kind: "verified-rename",
          contextId: "rename-1",
          oldPath: "Old Guide.md",
          targetPath: "Guides/New Guide.md"
        }
      ])
    ).toEqual([
      expect.objectContaining({
        type: "reference-normalization",
        evidence: [expect.objectContaining({ excerpt: "[[Old Guide|guide]]" })],
        affectedNoteIds: ["One.md", "Work/Two.md"]
      }),
      expect.objectContaining({
        type: "reference-normalization",
        evidence: [expect.objectContaining({ excerpt: "[Guide](../Old%20Guide.md#plan)" })],
        affectedNoteIds: ["One.md", "Work/Two.md"]
      })
    ]);
  });

  it("does not create default cleanup findings without an explicit context", () => {
    const snapshot = scanVaultFiles([
      { path: "Home.md", content: "[[Alias]]" },
      { path: "Target.md", content: "---\naliases: [Alias]\n---\n# Target" }
    ]);

    expect(buildContextualNormalizationFindings(snapshot, [])).toEqual([]);
    expect(
      buildContextualNormalizationFindings(snapshot, [
        {
          schemaVersion: 1,
          kind: "confirmed-canonical",
          contextId: "canonical-1",
          targetPath: "Target.md"
        }
      ])
    ).toEqual([]);
  });

  it("rejects ambiguous aliases and unsafe or missing context targets", () => {
    const snapshot = scanVaultFiles([
      { path: "One.md", content: "[[Alias]]\n[[Alias]]" },
      { path: "A.md", content: "---\naliases: [Alias]\n---\n# A" },
      { path: "B.md", content: "---\naliases: [Alias]\n---\n# B" }
    ]);

    expect(
      buildContextualNormalizationFindings(snapshot, [
        {
          schemaVersion: 1,
          kind: "confirmed-canonical",
          contextId: "canonical-1",
          targetPath: "../A.md"
        },
        {
          schemaVersion: 1,
          kind: "confirmed-canonical",
          contextId: "canonical-2",
          targetPath: "A.md"
        }
      ])
    ).toEqual([]);
  });
});
