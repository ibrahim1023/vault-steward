import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { proposeFix } from "../../src/review/propose.js";

const finding = {
  schemaVersion: 1 as const,
  id: "f",
  scanId: "s",
  type: "broken-reference" as const,
  severity: "medium" as const,
  evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
  affectedNoteIds: ["Home.md"],
  explanation: "Missing",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("deterministic proposals", () => {
  it("creates a revision-bound reference replacement without mutating the source", () => {
    const source = { path: "Home.md", revision: "hash", content: "See [[Missing]]." };
    const result = proposeFix(finding, source, "Target");
    expect(result).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          expect.objectContaining({ expected: "[[Missing]]", replacement: "[[Target]]" })
        ]
      }
    });
    expect(source.content).toBe("See [[Missing]].");
  });
  it("returns a non-applicable result for unsafe or unsupported proposals", () => {
    expect(
      proposeFix(
        { ...finding, type: "invalid-reference" },
        { path: "Home.md", revision: "hash", content: "x" },
        "Target"
      )
    ).toMatchObject({ applicable: false });
    expect(
      proposeFix(
        finding,
        { path: "Home.md", revision: "hash", content: "See [[Missing]]." },
        "Target#Injected|label"
      )
    ).toMatchObject({ applicable: false });
  });

  it("preserves an existing anchor and display label in the deterministic replacement", () => {
    const anchored = {
      ...finding,
      evidence: [
        {
          notePath: "Home.md",
          locator: "line:1",
          excerpt: "[[Missing#Plan|project plan]]"
        }
      ]
    };
    expect(
      proposeFix(
        anchored,
        {
          path: "Home.md",
          revision: "hash",
          content: "See [[Missing#Plan|project plan]]."
        },
        "Guides/Target"
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          {
            expected: "[[Missing#Plan|project plan]]",
            replacement: "[[Guides/Target#Plan|project plan]]"
          }
        ]
      }
    });
  });

  it("proposes the documented acceptance-vault repair", () => {
    const source = {
      path: "Work/Partner Enablement.md",
      revision: "fixture",
      content: readFileSync(
        resolve(process.cwd(), "fixtures/desktop-acceptance-vault/Work/Partner Enablement.md"),
        "utf8"
      )
    };
    const result = proposeFix(
      {
        ...finding,
        evidence: [
          {
            notePath: source.path,
            locator: "line:14",
            excerpt: "[[Guides/Partner Migration Checklist]]"
          }
        ]
      },
      source,
      "Guides/Partner Onboarding Checklist"
    );

    expect(result).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          expect.objectContaining({
            expected: "[[Guides/Partner Migration Checklist]]",
            replacement: "[[Guides/Partner Onboarding Checklist]]"
          })
        ]
      }
    });
  });
});
