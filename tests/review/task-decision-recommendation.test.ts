import { describe, expect, it } from "vitest";

import {
  recommendTaskDecisionRepair,
  selectTaskDecisionRepairWithProviders
} from "../../src/review/task-decision-recommendation.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";
import type { Finding } from "../../src/contracts/index.js";
import type { ModelProvider } from "../../src/model-provider/local-provider.js";

const finding: Finding = {
  schemaVersion: 1,
  id: "finding-1",
  scanId: "scan-fixed",
  type: "task",
  severity: "medium",
  evidence: [
    {
      notePath: "Work.md",
      locator: "line:1",
      excerpt: "- [ ] Ship owner:ada project:Projects/Northstar.md due:2026-07-01 ^ship"
    }
  ],
  affectedNoteIds: ["Work.md"],
  explanation: "Task ship is overdue.",
  suggestedFixes: [],
  confidence: 1,
  status: "open"
};

describe("task and decision repair recommendation", () => {
  it("accepts only an allowed snapshot candidate from the provider", async () => {
    const snapshot = {
      ...scanVaultFiles([
        {
          path: "Work.md",
          content: finding.evidence[0]!.excerpt,
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
    const result = await recommendTaskDecisionRepair({
      finding,
      snapshot,
      selectIntent: async (request) => ({
        schemaVersion: 1,
        kind: "replace-due-date",
        scanId: request.scanId,
        findingId: request.findingId,
        taskId: "ship",
        candidateId: request.candidates[0]!.id
      })
    });
    expect(result).toMatchObject({
      status: "ai-suggested",
      intent: { kind: "replace-due-date", taskId: "ship" }
    });
  });

  it("abstains when the provider chooses a candidate outside the request", async () => {
    const snapshot = {
      ...scanVaultFiles([
        { path: "Work.md", content: finding.evidence[0]!.excerpt, revision: "work" }
      ]),
      id: "scan-fixed"
    };
    const result = await recommendTaskDecisionRepair({
      finding,
      snapshot,
      selectIntent: async () => ({
        schemaVersion: 1,
        kind: "replace-due-date",
        scanId: "scan-fixed",
        findingId: "finding-1",
        taskId: "ship",
        candidateId: "invented"
      })
    });
    expect(result).toMatchObject({ status: "abstained" });
  });

  it("uses structured providers with a candidate-ID-only response contract", async () => {
    const provider: ModelProvider = {
      config: {
        kind: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model: "test",
        timeoutMs: 1_000,
        maxResponseBytes: 1_000
      },
      capabilities: ["structured-output"],
      async generate() {
        return {
          text: JSON.stringify({
            schemaVersion: 1,
            kind: "assign-owner",
            scanId: "scan-1",
            findingId: "finding-1",
            taskId: "ship",
            candidateId: "owner-ada"
          }),
          model: "test",
          provider: "ollama",
          latencyMs: 1
        };
      }
    };
    await expect(
      selectTaskDecisionRepairWithProviders([provider], {
        schemaVersion: 1,
        scanId: "scan-1",
        findingId: "finding-1",
        task: "select-task-decision-repair",
        instructions: "Select one bounded repair intent or abstain.",
        evidence: [{ id: "evidence-1", ref: finding.evidence[0]! }],
        allowedKinds: ["assign-owner"],
        candidates: [{ id: "owner-ada", value: "ada", category: "owner" }],
        taskId: "ship"
      })
    ).resolves.toMatchObject({ kind: "assign-owner", candidateId: "owner-ada" });
  });
});
