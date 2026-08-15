import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import type { Proposal } from "../../src/contracts/proposal.js";
import { ReviewWorkflow } from "../../src/review/workflow.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";
const proposal: Proposal = {
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
  it("fails closed when a note changes between preflight and the write boundary", async () => {
    const repo = await fixture();
    let content = "See x";
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content, revision: "r" }),
      write: async () => {
        throw new Error("fallback write must not run");
      },
      writeIfCurrent: async () => {
        content = "Changed after preflight";
        return false;
      }
    });
    workflow.act(proposal, "approved", "t");
    await expect(workflow.apply(proposal, "t2")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    expect(content).toBe("Changed after preflight");
  });

  it("rejects a proposal whose persisted digest no longer matches the approved patch", async () => {
    const repo = await fixture();
    const altered: Proposal = {
      ...proposal,
      operations: [{ ...proposal.operations[0]!, replacement: "attacker-controlled" }]
    };
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "See x", revision: "r" }),
      write: async () => undefined
    });
    workflow.act(proposal, "approved", "t");
    await expect(workflow.apply(altered, "t2")).rejects.toThrow("integrity");
    expect(repo.getProposalStatus(proposal.id)).toBe("approved");
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

  it("applies multiple ranges in one file from a single preflight snapshot", async () => {
    const repo = await fixture();
    const multi: Proposal = {
      ...proposal,
      id: "multi",
      operations: [
        {
          kind: "replace-range",
          path: "A.md",
          sourceRevision: "r",
          start: 2,
          end: 3,
          expected: "x",
          replacement: "X"
        },
        {
          kind: "replace-range",
          path: "A.md",
          sourceRevision: "r",
          start: 6,
          end: 7,
          expected: "y",
          replacement: "Y"
        }
      ]
    };
    repo.saveProposal({
      id: multi.id,
      findingId: multi.findingId,
      patchJson: JSON.stringify(multi),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
    let content = "a x b y";
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content, revision: "r" }),
      write: async (_path, next) => {
        content = next;
      }
    });
    workflow.act(multi, "approved", "t");

    await expect(workflow.apply(multi, "t2")).resolves.toEqual({ ok: true });
    expect(content).toBe("a X b Y");
  });

  it("rolls back an earlier file when a later write fails", async () => {
    const repo = await fixture();
    const multi: Proposal = {
      ...proposal,
      id: "rollback",
      operations: [
        {
          kind: "replace-range",
          path: "A.md",
          sourceRevision: "r",
          start: 0,
          end: 1,
          expected: "x",
          replacement: "X"
        },
        {
          kind: "replace-range",
          path: "B.md",
          sourceRevision: "r",
          start: 0,
          end: 1,
          expected: "y",
          replacement: "Y"
        }
      ]
    };
    repo.saveProposal({
      id: multi.id,
      findingId: multi.findingId,
      patchJson: JSON.stringify(multi),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
    const contents = new Map<string, string>([
      ["A.md", "x"],
      ["B.md", "y"]
    ]);
    const workflow = new ReviewWorkflow(repo, {
      read: async (path) => ({ content: contents.get(path) ?? "", revision: "r" }),
      write: async (path, next) => {
        if (path === "B.md" && next === "Y") throw new Error("disk full");
        contents.set(path, next);
      },
      writeIfCurrent: async (path, before, next) => {
        if (contents.get(path) !== before) return false;
        if (path === "B.md" && next === "Y") throw new Error("disk full");
        contents.set(path, next);
        return true;
      }
    });
    workflow.act(multi, "approved", "t");

    await expect(workflow.apply(multi, "t2")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    expect(contents).toEqual(
      new Map<string, string>([
        ["A.md", "x"],
        ["B.md", "y"]
      ])
    );
    expect(repo.getProposalStatus(multi.id)).toBe("apply-failed");
  });

  it("marks an unreadable approved proposal as failed instead of leaving it applying", async () => {
    const repo = await fixture();
    const workflow = new ReviewWorkflow(repo, {
      read: async () => Promise.reject(new Error("disk unavailable")),
      write: async () => undefined
    });
    workflow.act(proposal, "approved", "t");

    await expect(workflow.apply(proposal, "t2")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    expect(repo.getProposalStatus(proposal.id)).toBe("apply-failed");
  });
});
