import { describe, expect, it } from "vitest";

import { normalizeFinding } from "../../src/findings/normalize.js";

const first = { notePath: "People/Ada.md", locator: "line:1", excerpt: "Ada Lovelace" };
const second = { notePath: "Projects/Research.md", locator: "line:4", excerpt: "Ada L." };

describe("unified finding normalization", () => {
  it("creates an open typed finding from bounded scan evidence", () => {
    expect(
      normalizeFinding({
        scanId: "scan-1",
        type: "entity-alias",
        severity: "low",
        evidence: [first, second],
        availableEvidence: [first, second],
        explanation: "The two labels likely describe the same person.",
        confidence: 0.8
      })
    ).toMatchObject({
      schemaVersion: 1,
      type: "entity-alias",
      status: "open",
      affectedNoteIds: ["People/Ada.md", "Projects/Research.md"]
    });
  });

  it("rejects unsupported, uncited, and invalid-confidence candidates", () => {
    expect(
      normalizeFinding({
        scanId: "scan-1",
        type: "contradiction",
        severity: "low",
        evidence: [],
        availableEvidence: [first],
        explanation: "No evidence.",
        confidence: 0.8
      })
    ).toBeNull();
    expect(
      normalizeFinding({
        scanId: "scan-1",
        type: "entity-alias",
        severity: "low",
        evidence: [second],
        availableEvidence: [first],
        explanation: "Uncited evidence.",
        confidence: 0.8
      })
    ).toBeNull();
    expect(
      normalizeFinding({
        scanId: "scan-1",
        type: "entity-alias",
        severity: "low",
        evidence: [first],
        availableEvidence: [first],
        explanation: "Invalid confidence.",
        confidence: 1.1
      })
    ).toBeNull();
  });
});
