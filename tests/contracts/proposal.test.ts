import { describe, expect, it } from "vitest";

import { parseProposal } from "../../src/contracts/proposal.js";

describe("proposal contracts", () => {
  it("accepts a versioned revision-bound replacement", () => {
    expect(
      parseProposal({
        schemaVersion: 1,
        id: "proposal-1",
        findingId: "finding-1",
        scanId: "scan-1",
        explanation: "Repair the broken reference.",
        operations: [
          {
            kind: "replace-range",
            path: "Home.md",
            sourceRevision: "hash-1",
            start: 10,
            end: 21,
            expected: "[[Missing]]",
            replacement: "[[Target]]"
          }
        ]
      })
    ).toMatchObject({ ok: true });
  });

  it("rejects unknown operations and unsafe or inconsistent patches", () => {
    for (const operation of [
      { kind: "shell", path: "Home.md" },
      {
        kind: "replace-range",
        path: "../Home.md",
        sourceRevision: "a",
        start: 2,
        end: 1,
        expected: "x",
        replacement: "y"
      },
      {
        kind: "replace-range",
        path: "Home.md",
        sourceRevision: "a",
        start: 0,
        end: 1,
        expected: "",
        replacement: "y"
      }
    ]) {
      expect(
        parseProposal({
          schemaVersion: 1,
          id: "p",
          findingId: "f",
          scanId: "s",
          explanation: "Safe",
          operations: [operation]
        })
      ).toMatchObject({ ok: false });
    }
  });
});
