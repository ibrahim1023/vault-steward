import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { proposeFix, proposeReferenceRepair } from "../../src/review/propose.js";

const finding = {
  schemaVersion: 1 as const,
  id: "f",
  scanId: "s",
  type: "broken-reference" as const,
  severity: "medium" as const,
  evidence: [{ notePath: "Home.md", locator: "line:1:column:5", excerpt: "[[Missing]]" }],
  affectedNoteIds: ["Home.md"],
  explanation: "Missing",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("deterministic proposals", () => {
  it("rejects legacy and ambiguous-looking evidence instead of selecting the first match", () => {
    const duplicate = { path: "Home.md", revision: "hash", content: "[[Missing]]\n[[Missing]]" };
    expect(
      proposeFix(
        { ...finding, evidence: [{ ...finding.evidence[0]!, locator: "line:1" }] },
        duplicate,
        "Target"
      )
    ).toMatchObject({ applicable: false });
    expect(
      proposeFix(
        { ...finding, evidence: [{ ...finding.evidence[0]!, locator: "line:2:column:1" }] },
        duplicate,
        "Target"
      )
    ).toMatchObject({
      applicable: true,
      proposal: { operations: [{ start: "[[Missing]]\n".length }] }
    });
  });
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
          locator: "line:1:column:5",
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

  it("preserves wiki embed syntax, anchors, and display labels", () => {
    const embedded = {
      ...finding,
      evidence: [
        {
          notePath: "Home.md",
          locator: "line:1:column:5",
          excerpt: "![[Missing#Plan|embedded plan]]"
        }
      ]
    };

    expect(
      proposeFix(
        embedded,
        {
          path: "Home.md",
          revision: "hash",
          content: "See ![[Missing#Plan|embedded plan]]."
        },
        "Guides/Target"
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          {
            expected: "![[Missing#Plan|embedded plan]]",
            replacement: "![[Guides/Target#Plan|embedded plan]]"
          }
        ]
      }
    });
  });

  it("rewrites an internal Markdown link relative to its source and preserves its anchor", () => {
    const markdown = {
      ...finding,
      evidence: [
        {
          notePath: "Work/Home.md",
          locator: "line:1:column:1",
          excerpt: "[Read the guide](Missing.md#plan)"
        }
      ]
    };

    expect(
      proposeFix(
        markdown,
        {
          path: "Work/Home.md",
          revision: "hash",
          content: "[Read the guide](Missing.md#plan)"
        },
        "Guides/Target"
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          {
            expected: "[Read the guide](Missing.md#plan)",
            replacement: "[Read the guide](../Guides/Target.md#plan)"
          }
        ]
      }
    });
  });

  it("preserves Markdown embed syntax for an in-vault parent-relative reference", () => {
    const embedded = {
      ...finding,
      evidence: [
        {
          notePath: "Work/Home.md",
          locator: "line:1:column:1",
          excerpt: "![Guide](../Missing.md#plan)"
        }
      ]
    };

    expect(
      proposeFix(
        embedded,
        {
          path: "Work/Home.md",
          revision: "hash",
          content: "![Guide](../Missing.md#plan)"
        },
        "Guides/Target"
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [
          {
            expected: "![Guide](../Missing.md#plan)",
            replacement: "![Guide](../Guides/Target.md#plan)"
          }
        ]
      }
    });
  });

  it.each([
    {
      excerpt: "[[Target#Missing|plan]]",
      replacement: "[[Target#Project Plan|plan]]"
    },
    {
      excerpt: "![[Target#Missing|plan]]",
      replacement: "![[Target#Project Plan|plan]]"
    },
    {
      excerpt: "[plan](Target.md#Missing)",
      replacement: "[plan](Target.md#Project Plan)"
    },
    {
      excerpt: "![plan](Target.md#Missing)",
      replacement: "![plan](Target.md#Project Plan)"
    }
  ])(
    "replaces a heading anchor without changing reference syntax: $excerpt",
    ({ excerpt, replacement }) => {
      const anchored = {
        ...finding,
        evidence: [{ notePath: "Home.md", locator: "line:1:column:1", excerpt }]
      };
      expect(
        proposeReferenceRepair(
          anchored,
          { path: "Home.md", revision: "hash", content: excerpt },
          {
            schemaVersion: 1,
            kind: "replace-heading-anchor",
            scanId: "s",
            findingId: "f",
            targetPath: "Target.md",
            provenance: "ai-suggested",
            anchor: {
              kind: "heading",
              value: "Project Plan",
              candidateId: "anchor:heading:target"
            }
          }
        )
      ).toMatchObject({
        applicable: true,
        proposal: { operations: [{ expected: excerpt, replacement }] }
      });
    }
  );

  it("renders block anchors with the required caret", () => {
    const excerpt = "[[Target#Missing]]";
    expect(
      proposeReferenceRepair(
        { ...finding, evidence: [{ notePath: "Home.md", locator: "line:1:column:1", excerpt }] },
        { path: "Home.md", revision: "hash", content: excerpt },
        {
          schemaVersion: 1,
          kind: "replace-block-anchor",
          scanId: "s",
          findingId: "f",
          targetPath: "Target.md",
          provenance: "ai-suggested",
          anchor: {
            kind: "block",
            value: "plan-block",
            candidateId: "anchor:block:target"
          }
        }
      )
    ).toMatchObject({
      applicable: true,
      proposal: {
        operations: [{ expected: excerpt, replacement: "[[Target#^plan-block]]" }]
      }
    });
  });

  it("rejects external and malformed Markdown replacement targets", () => {
    const markdown = {
      ...finding,
      evidence: [
        { notePath: "Home.md", locator: "line:1:column:1", excerpt: "[Guide](Missing.md)" }
      ]
    };
    const source = { path: "Home.md", revision: "hash", content: "[Guide](Missing.md)" };

    expect(proposeFix(markdown, source, "https://example.com/guide")).toMatchObject({
      applicable: false
    });
    expect(proposeFix(markdown, source, "Guides/Target#Injected")).toMatchObject({
      applicable: false
    });
    expect(
      proposeFix(
        {
          ...markdown,
          evidence: [{ ...markdown.evidence[0]!, excerpt: "[Guide](../Missing.md)" }]
        },
        { ...source, content: "[Guide](../Missing.md)" },
        "Guides/Target"
      )
    ).toMatchObject({ applicable: false });
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
            locator: "line:19:column:30",
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
