import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import type { Proposal } from "../../src/contracts/proposal.js";
import { ReviewWorkflow } from "../../src/review/workflow.js";
import { applyMigrations } from "../../src/storage/migrations.js";
import { VaultStewardRepository } from "../../src/storage/repositories.js";

function proposal(
  id: string,
  findingId: string,
  path: string,
  start: number,
  expected: string,
  replacement: string
): Proposal {
  return {
    schemaVersion: 1,
    id,
    findingId,
    scanId: "scan",
    explanation: "Repair",
    operations: [
      {
        kind: "replace-range",
        path,
        sourceRevision: "revision",
        start,
        end: start + expected.length,
        expected,
        replacement
      }
    ]
  };
}

async function fixture(proposals: readonly Proposal[]) {
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
    configHash: "config",
    inputHash: "input",
    parserVersion: "parser"
  });
  for (const item of proposals) {
    repository.saveFinding({
      id: item.findingId,
      scanId: item.scanId,
      type: "broken-reference",
      severity: "medium",
      status: "open",
      evidenceJson: "[]",
      payloadJson: "{}"
    });
    repository.saveProposal({
      id: item.id,
      findingId: item.findingId,
      patchJson: JSON.stringify(item),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
  }
  return repository;
}

describe("prepared repair batch workflow", () => {
  it("records individual approvals, preflights all members, applies grouped writes, and reindexes once", async () => {
    const proposals = [
      proposal("proposal-1", "finding-1", "Home.md", 0, "a", "A"),
      proposal("proposal-2", "finding-2", "Home.md", 2, "b", "B")
    ];
    const repository = await fixture(proposals);
    let content = "a b";
    let writes = 0;
    let reindexes = 0;
    const workflow = new ReviewWorkflow(repository, {
      read: async () => ({ content, revision: "revision" }),
      write: async (_path, next) => {
        writes += 1;
        content = next;
      }
    });

    await expect(
      workflow.approveAndApplyBatch(proposals, "acted-at", {
        onReindex: async () => {
          reindexes += 1;
        }
      })
    ).resolves.toEqual({
      ok: true,
      appliedProposalIds: ["proposal-1", "proposal-2"],
      skippedProposalIds: [],
      failedProposalIds: [],
      notesEdited: 1,
      reindexed: true
    });
    expect(content).toBe("A B");
    expect(writes).toBe(1);
    expect(reindexes).toBe(1);
    expect(repository.getRecordCounts().approvals).toBe(4);
    expect(repository.getProposalStatus("proposal-1")).toBe("applied");
    expect(repository.getProposalStatus("proposal-2")).toBe("applied");
  });

  it("rejects the entire batch before writes when one source is stale", async () => {
    const proposals = [
      proposal("proposal-1", "finding-1", "A.md", 0, "a", "A"),
      proposal("proposal-2", "finding-2", "B.md", 0, "b", "B")
    ];
    const repository = await fixture(proposals);
    let writes = 0;
    const workflow = new ReviewWorkflow(repository, {
      read: async (path) => ({
        content: path === "B.md" ? "changed" : "a",
        revision: path === "B.md" ? "new-revision" : "revision"
      }),
      write: async () => {
        writes += 1;
      }
    });

    await expect(workflow.approveAndApplyBatch(proposals, "acted-at")).resolves.toEqual({
      ok: false,
      reason: "stale",
      appliedProposalIds: [],
      skippedProposalIds: ["proposal-1", "proposal-2"],
      failedProposalIds: [],
      notesEdited: 0,
      reindexed: false
    });
    expect(writes).toBe(0);
    expect(repository.getProposalStatus("proposal-1")).toBe("stale");
    expect(repository.getProposalStatus("proposal-2")).toBe("stale");
  });

  it("rejects altered digests, duplicate findings, and overlapping operations before approval", async () => {
    const first = proposal("proposal-1", "finding-1", "Home.md", 0, "ab", "AB");
    const second = proposal("proposal-2", "finding-2", "Home.md", 1, "bc", "BC");
    const repository = await fixture([first, second]);
    let writes = 0;
    const workflow = new ReviewWorkflow(repository, {
      read: async () => ({ content: "abc", revision: "revision" }),
      write: async () => {
        writes += 1;
      }
    });

    await expect(
      workflow.approveAndApplyBatch(
        [{ ...first, operations: [{ ...first.operations[0]!, replacement: "tampered" }] }, second],
        "acted-at"
      )
    ).resolves.toMatchObject({ ok: false, reason: "invalid" });
    expect(repository.getRecordCounts().approvals).toBe(0);

    await expect(workflow.approveAndApplyBatch([first, second], "acted-at")).resolves.toMatchObject(
      {
        ok: false,
        reason: "invalid"
      }
    );
    expect(writes).toBe(0);
    expect(repository.getRecordCounts().approvals).toBe(0);
  });

  it("rolls back earlier writes and reports recovery-required when rollback fails", async () => {
    const proposals = [
      proposal("proposal-1", "finding-1", "A.md", 0, "a", "A"),
      proposal("proposal-2", "finding-2", "B.md", 0, "b", "B")
    ];
    const repository = await fixture(proposals);
    const contents = new Map([
      ["A.md", "a"],
      ["B.md", "b"]
    ]);
    let rollingBack = false;
    const workflow = new ReviewWorkflow(repository, {
      read: async (path) => ({
        content: contents.get(path) ?? "",
        revision: "revision"
      }),
      write: async (path, next) => {
        if (path === "B.md") {
          rollingBack = true;
          throw new Error("disk full");
        }
        if (rollingBack && path === "A.md") throw new Error("rollback blocked");
        contents.set(path, next);
      }
    });

    await expect(workflow.approveAndApplyBatch(proposals, "acted-at")).resolves.toEqual({
      ok: false,
      reason: "recovery-required",
      appliedProposalIds: [],
      skippedProposalIds: [],
      failedProposalIds: ["proposal-1", "proposal-2"],
      notesEdited: 0,
      reindexed: false
    });
    expect(repository.getProposalStatus("proposal-1")).toBe("recovery-required");
    expect(repository.getProposalStatus("proposal-2")).toBe("recovery-required");
  });
});
