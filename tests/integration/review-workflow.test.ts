import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { ReviewWorkflow } from "../../src/review/workflow.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";
const proposal = {
  schemaVersion: 1 as const,
  id: "p",
  findingId: "f",
  scanId: "s",
  explanation: "Repair",
  operations: [
    {
      kind: "replace-range" as const,
      path: "A.md",
      sourceRevision: "r",
      start: 4,
      end: 5,
      expected: "x",
      replacement: "y"
    }
  ]
};
async function fixture() {
  const sql = await initSqlJs({ locateFile: (file) => `node_modules/sql.js/dist/${file}` });
  const db = new sql.Database();
  applyMigrations(db);
  const repo = new VaultStewardRepository(db);
  repo.saveScan({
    id: "s",
    vaultFingerprint: "v",
    startedAt: "now",
    finishedAt: null,
    status: "running",
    configHash: "c",
    inputHash: "i",
    parserVersion: "p"
  });
  repo.saveFinding({
    id: "f",
    scanId: "s",
    type: "broken-reference",
    severity: "medium",
    status: "open",
    evidenceJson: "[]",
    payloadJson: "{}"
  });
  repo.saveProposal({
    id: "p",
    findingId: "f",
    patchJson: JSON.stringify(proposal),
    sourceRevisionsJson: "{}",
    status: "pending"
  });
  return repo;
}
describe("review workflow", () => {
  it("requires an explicit approval before applying", async () => {
    const repo = await fixture();
    let content = "See x";
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content, revision: "r" }),
      write: async (_path, next) => {
        content = next;
      }
    });
    await expect(workflow.apply(proposal, "t")).rejects.toThrow("Only approved");
    workflow.act(proposal, "approved", "t");
    await expect(workflow.apply(proposal, "t2")).resolves.toEqual({ ok: true });
    expect(content).toBe("See y");
    expect(repo.getProposalStatus("p")).toBe("applied");
  });
  it("marks a stale proposal without writing", async () => {
    const repo = await fixture();
    let writes = 0;
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "changed", revision: "new" }),
      write: async () => {
        writes++;
      }
    });
    workflow.act(proposal, "approved", "t");
    await expect(workflow.apply(proposal, "t2")).resolves.toEqual({ ok: false, reason: "stale" });
    expect(writes).toBe(0);
  });
  it("marks failed or interrupted applies for explicit recovery", async () => {
    const repo = await fixture();
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "See x", revision: "r" }),
      write: async () => {
        throw new Error("disk full");
      }
    });
    workflow.act(proposal, "approved", "t");
    await expect(workflow.apply(proposal, "t2")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    let reindexes = 0;
    expect(
      workflow.recoverInterruptedApplies(() => {
        reindexes++;
      })
    ).toBe(1);
    expect(repo.getProposalStatus("p")).toBe("recovery-required");
    expect(reindexes).toBe(1);
    expect(repo.getRecordCounts().approvals).toBe(1);
  });
  it("records dismiss and defer actions without granting write permission", async () => {
    for (const action of ["dismissed", "deferred"] as const) {
      const repo = await fixture();
      const workflow = new ReviewWorkflow(repo, {
        read: async () => ({ content: "See x", revision: "r" }),
        write: async () => {
          throw new Error("must not write");
        }
      });
      workflow.act(proposal, action, "t");
      expect(repo.getProposalStatus("p")).toBe(action);
      await expect(workflow.apply(proposal, "t2")).rejects.toThrow("Only approved");
      expect(repo.getRecordCounts().approvals).toBe(1);
    }
  });
  it("cancels before writing and schedules re-index only after success", async () => {
    const repo = await fixture();
    let writes = 0;
    let reindexes = 0;
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "See x", revision: "r" }),
      write: async () => {
        writes++;
      }
    });
    workflow.act(proposal, "approved", "t");
    const controller = new AbortController();
    controller.abort();
    await expect(
      workflow.apply(proposal, "t2", {
        signal: controller.signal,
        onReindex: () => {
          reindexes++;
        }
      })
    ).resolves.toEqual({ ok: false, reason: "canceled" });
    expect(writes).toBe(0);
    await expect(
      workflow.apply(proposal, "t3", {
        onReindex: () => {
          reindexes++;
        }
      })
    ).resolves.toEqual({ ok: true });
    expect(reindexes).toBe(1);
  });
});
