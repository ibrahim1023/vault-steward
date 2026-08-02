import { describe, expect, it, vi } from "vitest";
import { prepareTemplateRepairBatch } from "../../src/review/prepare-template-repair-batch.js";
import {
  buildTemplateRepairCandidates,
  proposeTemplateFrontmatterRepair
} from "../../src/review/template-propose.js";

const finding = {
  schemaVersion: 1 as const,
  id: "finding",
  scanId: "scan",
  type: "schema" as const,
  severity: "low" as const,
  evidence: [{ notePath: "Projects/Atlas.md", locator: "frontmatter:owner", excerpt: "" }],
  affectedNoteIds: ["Projects/Atlas.md"],
  explanation: "Project notes require 'owner'.",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};
const snapshot = {
  id: "scan",
  notes: [
    {
      path: "Projects/Atlas.md",
      content: "---\nkind: project\n---\n# Atlas",
      frontmatter: { kind: "project" },
      revision: "a",
      headings: ["Atlas"],
      blockIds: [],
      references: []
    },
    {
      path: "Projects/Beta.md",
      content: "",
      frontmatter: { kind: "project", owner: "Maya" },
      revision: "b",
      headings: ["Beta"],
      blockIds: [],
      references: []
    }
  ]
};
describe("template frontmatter repairs", () =>
  it("accepts only a snapshot candidate for a known missing template field", () => {
    const [candidate] = buildTemplateRepairCandidates(snapshot, finding);
    expect(candidate?.value).toBe("Maya");
    expect(
      proposeTemplateFrontmatterRepair({
        finding,
        snapshot,
        source: { path: "Projects/Atlas.md", revision: "a", content: snapshot.notes[0]!.content },
        intent: {
          schemaVersion: 1,
          kind: "set-frontmatter",
          scanId: "scan",
          findingId: "finding",
          templateId: "project",
          field: "owner",
          candidateId: candidate!.id
        }
      })
    ).toMatchObject({
      applicable: true,
      proposal: { operations: [expect.objectContaining({ replacement: '---\nowner: "Maya"\n' })] }
    });
  }));

it("prepares only an unambiguous snapshot-derived template repair", async () => {
  const persisted = vi.fn();
  const prepared = await prepareTemplateRepairBatch({
    snapshot,
    findings: [finding],
    readSource: async () => ({ revision: "a", content: snapshot.notes[0]!.content }),
    persistProposal: persisted
  });
  expect(prepared?.items[0]).toMatchObject({
    repairFamily: "schema",
    repairKind: "set-frontmatter"
  });
  expect(persisted).toHaveBeenCalledOnce();
});
