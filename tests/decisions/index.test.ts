import { describe, expect, it } from "vitest";
import { checkDecisions, indexDecision } from "../../src/decisions/index.js";

describe("decision indexing", () => {
  it("retains ADR evidence and identifies unresolved rationale and supersession cycles", () => {
    const a = indexDecision("Decisions/A.md", { kind: "decision", supersedes: "Decisions/B.md" });
    const b = indexDecision("Decisions/B.md", {
      kind: "decision",
      rationale: "why",
      supersedes: "Decisions/A.md"
    });
    if (!a || !b) throw new Error("expected decisions");
    expect(a.evidenceLocator).toBe("frontmatter:kind");
    expect(checkDecisions([a, b])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missing-rationale", evidenceLocator: "frontmatter:kind" }),
        expect.objectContaining({ kind: "supersedes-cycle" })
      ])
    );
  });
});
