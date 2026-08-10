import { describe, expect, it, vi } from "vitest";

import { prepareTaskDecisionRepairBatch } from "../../src/review/prepare-task-decision-batch.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";
import type { Finding } from "../../src/contracts/index.js";

describe("prepared task and decision repair batch", () => {
  it("persists one digest-bound task proposal with a generic exact review item", async () => {
    const snapshot = {
      ...scanVaultFiles([
        {
          path: "Work.md",
          content: "- [ ] Ship owner:ada project:Projects/Northstar.md due:2026-07-01 ^ship",
          revision: "work"
        },
        {
          path: "Projects/Northstar.md",
          content: "---\nkind: project\ndue: 2026-08-15\n---\n# Northstar",
          revision: "project"
        }
      ]),
      id: "scan-fixed"
    };
    const finding: Finding = {
      schemaVersion: 1,
      id: "finding-1",
      scanId: "scan-fixed",
      type: "task",
      severity: "medium",
      evidence: [
        {
          notePath: "Work.md",
          locator: "line:1:column:1",
          excerpt: "- [ ] Ship owner:ada project:Projects/Northstar.md due:2026-07-01 ^ship"
        }
      ],
      affectedNoteIds: ["Work.md"],
      explanation: "Task ship is overdue.",
      suggestedFixes: [],
      confidence: 1,
      status: "open"
    };
    const persistProposal = vi.fn();
    const prepared = await prepareTaskDecisionRepairBatch({
      snapshot,
      findings: [finding],
      readSource: async () => ({ revision: "work", content: snapshot.notes[0]!.content }),
      selectIntent: async (request) => ({
        schemaVersion: 1,
        kind: "replace-due-date",
        scanId: request.scanId,
        findingId: request.findingId,
        taskId: "ship",
        candidateId: request.candidates[0]!.id
      }),
      persistProposal
    });

    expect(prepared).toMatchObject({
      batch: { findingIds: ["finding-1"] },
      items: [
        {
          repairFamily: "task",
          repairKind: "replace-due-date",
          currentReference: "due:2026-07-01",
          replacementReference: "due:2026-08-15"
        }
      ]
    });
    expect(persistProposal).toHaveBeenCalledOnce();
  });

  it("prepares a decision relation update from a snapshot-derived project only", async () => {
    const snapshot = {
      ...scanVaultFiles([
        {
          path: "Decisions/ADR-1.md",
          content:
            "---\nkind: decision\nrationale: Valid rationale.\nproject: Projects/Missing.md\n---\n# ADR",
          revision: "decision"
        },
        {
          path: "Projects/Northstar.md",
          content: "---\nkind: project\n---\n# Northstar",
          revision: "project"
        }
      ]),
      id: "scan-fixed"
    };
    const finding: Finding = {
      schemaVersion: 1,
      id: "decision-finding",
      scanId: "scan-fixed",
      type: "decision",
      severity: "low",
      evidence: [
        { notePath: "Decisions/ADR-1.md", locator: "line:2:column:7", excerpt: "decision" }
      ],
      affectedNoteIds: ["Decisions/ADR-1.md"],
      explanation: "Decision Decisions/ADR-1.md has missing project target.",
      suggestedFixes: [],
      confidence: 1,
      status: "open"
    };
    const prepared = await prepareTaskDecisionRepairBatch({
      snapshot,
      findings: [finding],
      readSource: async () => ({
        revision: "decision",
        content:
          "---\nkind: decision\nrationale: Valid rationale.\nproject: Projects/Missing.md\n---\n# ADR"
      }),
      selectIntent: async (request) => ({
        schemaVersion: 1,
        kind: "link-project",
        scanId: request.scanId,
        findingId: request.findingId,
        decisionId: "Decisions/ADR-1.md",
        candidateId: request.candidates[0]!.id
      }),
      persistProposal: () => undefined
    });
    expect(prepared).toMatchObject({
      items: [
        {
          repairFamily: "decision",
          repairKind: "link-project",
          currentReference: "project: Projects/Missing.md",
          replacementReference: 'project: "Projects/Northstar.md"'
        }
      ]
    });
  });

  it("uses the same unused duplicate task ID candidate that the model selected", async () => {
    const first = "- [ ] First owner:ada project:Projects/Northstar.md ^ship";
    const duplicate = "- [ ] Duplicate owner:ada project:Projects/Northstar.md ^ship";
    const snapshot = {
      ...scanVaultFiles([
        {
          path: "Work.md",
          content: `${first}\n${duplicate}\n- [ ] Existing ^ship-2`,
          revision: "work"
        },
        { path: "Projects/Northstar.md", content: "---\nkind: project\n---", revision: "project" }
      ]),
      id: "scan-fixed"
    };
    const finding: Finding = {
      schemaVersion: 1,
      id: "duplicate-finding",
      scanId: "scan-fixed",
      type: "task",
      severity: "low",
      evidence: [{ notePath: "Work.md", locator: "line:2:column:1", excerpt: duplicate }],
      affectedNoteIds: ["Work.md"],
      explanation: "Task ship is duplicated.",
      suggestedFixes: [],
      confidence: 1,
      status: "open"
    };
    const prepared = await prepareTaskDecisionRepairBatch({
      snapshot,
      findings: [finding],
      readSource: async () => ({ revision: "work", content: snapshot.notes[0]!.content }),
      selectIntent: async (request) => ({
        schemaVersion: 1,
        kind: "resolve-duplicate-id",
        scanId: request.scanId,
        findingId: request.findingId,
        taskId: "ship",
        candidateId: request.candidates[0]!.id
      }),
      persistProposal: () => undefined
    });
    expect(prepared?.items[0]).toMatchObject({
      currentReference: "^ship",
      replacementReference: "^ship-3"
    });
  });
});
