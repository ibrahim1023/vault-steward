import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { ReviewWorkflow } from "../../src/review/workflow.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

describe("review to apply workflow", () => {
  it("requires approval, applies the approved diff, and leaves an audit record", async () => {
    const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
    const database = new sql.Database();
    applyMigrations(database);
    const repository = new VaultStewardRepository(database);
    repository.saveScan({
      id: "scan",
      vaultFingerprint: "vault",
      startedAt: "now",
      finishedAt: null,
      status: "running",
      configHash: "c",
      inputHash: "i",
      parserVersion: "p"
    });
    repository.saveFinding({
      id: "finding",
      scanId: "scan",
      type: "broken-reference",
      severity: "medium",
      status: "open",
      evidenceJson: "[]",
      payloadJson: "{}"
    });
    const proposal = {
      schemaVersion: 1 as const,
      id: "proposal",
      findingId: "finding",
      scanId: "scan",
      explanation: "Repair",
      operations: [
        {
          kind: "replace-range" as const,
          path: "Home.md",
          sourceRevision: "r1",
          start: 4,
          end: 15,
          expected: "[[Missing]]",
          replacement: "[[Target]]"
        }
      ]
    };
    repository.saveProposal({
      id: proposal.id,
      findingId: proposal.findingId,
      patchJson: JSON.stringify(proposal),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
    let content = "See [[Missing]]";
    let writes = 0;
    const workflow = new ReviewWorkflow(repository, {
      read: async () => ({ content, revision: "r1" }),
      write: async (_path, next) => {
        writes++;
        content = next;
      }
    });
    await expect(workflow.apply(proposal, "t")).rejects.toThrow("Only approved");
    expect(writes).toBe(0);
    workflow.act(proposal, "approved", "t");
    await expect(workflow.apply(proposal, "t2")).resolves.toEqual({ ok: true });
    expect(content).toBe("See [[Target]]");
    expect(repository.getRecordCounts().approvals).toBe(2);
  });
});
