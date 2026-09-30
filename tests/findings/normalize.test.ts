import { describe, expect, it } from "vitest";

import { createEntityAliasFindingIdentity } from "../../src/findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../../src/findings/normalize.js";

const first: PromotedEvidence = {
  notePath: "People/Ada.md",
  locator: "line:1",
  excerpt: "Ada Lovelace",
  role: "operand",
  subjectId: "subject-a",
  sourceRevision: "rev-a"
};
const second: PromotedEvidence = {
  notePath: "Projects/Research.md",
  locator: "line:4",
  excerpt: "Ada L.",
  role: "operand",
  subjectId: "subject-b",
  sourceRevision: "rev-b"
};

const identity = () => createEntityAliasFindingIdentity({ subjectIds: ["subject-a", "subject-b"] });

const baseInput = () => ({
  scanId: "scan-1",
  type: "entity-alias" as const,
  severity: "low" as const,
  identity: identity(),
  evidence: [first, second] as const,
  availableEvidence: [first, second] as const,
  explanation: "The two labels likely describe the same person.",
  confidence: 0.8
});

describe("finding promotion boundary", () => {
  it("promotes a canonical identity plus promoted evidence to schema v2", () => {
    const finding = normalizeFinding(baseInput());

    expect(finding).toMatchObject({
      schemaVersion: 2,
      type: "entity-alias",
      status: "open",
      affectedNoteIds: ["People/Ada.md", "Projects/Research.md"]
    });
    expect(finding?.stableKey).toMatch(/^finding:v1:[0-9a-f]{64}$/);
    expect(finding?.occurrenceId).toMatch(/^occurrence:v1:[0-9a-f]{64}$/);
    expect(finding?.evidenceRevisionKey).toMatch(/^evidence:v1:[0-9a-f]{64}$/);
    expect(finding?.identity.stableKey).toBe(finding?.stableKey);
  });

  it("derives identical keys when only display excerpts change", () => {
    const initial = normalizeFinding(baseInput());
    const changedExcerpt = normalizeFinding({
      ...baseInput(),
      evidence: [{ ...first, excerpt: "different excerpt" }, second],
      availableEvidence: [{ ...first, excerpt: "different excerpt" }, second]
    });

    expect(changedExcerpt?.stableKey).toBe(initial?.stableKey);
    expect(changedExcerpt?.evidenceRevisionKey).toBe(initial?.evidenceRevisionKey);
    expect(changedExcerpt?.occurrenceId).toBe(initial?.occurrenceId);
    expect(changedExcerpt?.id).toBe(initial?.id);
  });

  it("derives a different evidence revision when a cited source revision changes", () => {
    const initial = normalizeFinding(baseInput());
    const revised = normalizeFinding({
      ...baseInput(),
      evidence: [{ ...first, sourceRevision: "rev-a2" }, second]
    });

    expect(revised?.stableKey).toBe(initial?.stableKey);
    expect(revised?.evidenceRevisionKey).not.toBe(initial?.evidenceRevisionKey);
    expect(revised?.occurrenceId).not.toBe(initial?.occurrenceId);
  });

  it("rejects a missing or tampered identity", () => {
    expect(
      normalizeFinding({
        ...baseInput(),
        identity: undefined as unknown as ReturnType<typeof identity>
      })
    ).toBeNull();
    expect(
      normalizeFinding({
        ...baseInput(),
        identity: { ...identity(), stableKey: `finding:v1:${"0".repeat(64)}` }
      })
    ).toBeNull();
    expect(
      normalizeFinding({
        ...baseInput(),
        identity: { ...identity(), family: "contradiction" }
      })
    ).toBeNull();
    expect(normalizeFinding({ ...baseInput(), type: "contradiction" })).toBeNull();
  });

  it("still rejects unsupported, uncited, and invalid-confidence candidates", () => {
    expect(normalizeFinding({ ...baseInput(), evidence: [] })).toBeNull();
    expect(
      normalizeFinding({ ...baseInput(), evidence: [second], availableEvidence: [first] })
    ).toBeNull();
    expect(normalizeFinding({ ...baseInput(), confidence: 1.1 })).toBeNull();
    expect(normalizeFinding({ ...baseInput(), confidence: Number.NaN })).toBeNull();
    expect(normalizeFinding({ ...baseInput(), scanId: "" })).toBeNull();
    expect(normalizeFinding({ ...baseInput(), explanation: "   " })).toBeNull();
  });

  it("preserves suggested fixes supplied by the producer", () => {
    const finding = normalizeFinding({
      ...baseInput(),
      suggestedFixes: [{ description: "Merge the aliases." }]
    });

    expect(finding?.suggestedFixes).toEqual([{ description: "Merge the aliases." }]);
  });
});
