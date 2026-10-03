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
    await expect(workflow.apply(proposal, "2026-09-29T00:00:00.000Z")).rejects.toThrow(
      "Only approved"
    );
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(proposal, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
      ok: true
    });
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
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(proposal, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
      ok: false,
      reason: "stale"
    });
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
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(proposal, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
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
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(altered, "2026-09-29T00:00:01.000Z")).rejects.toThrow("integrity");
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
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(proposal, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
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
      workflow.act(proposal, action, "2026-09-29T00:00:00.000Z");
      expect(repo.getProposalStatus("p")).toBe(action);
      await expect(workflow.apply(proposal, "2026-09-29T00:00:01.000Z")).rejects.toThrow(
        "Only approved"
      );
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
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    const controller = new AbortController();
    controller.abort();
    await expect(
      workflow.apply(proposal, "2026-09-29T00:00:01.000Z", {
        signal: controller.signal,
        onReindex: () => {
          reindexes++;
        }
      })
    ).resolves.toEqual({ ok: false, reason: "canceled" });
    expect(writes).toBe(0);
    await expect(
      workflow.apply(proposal, "2026-09-29T00:00:02.000Z", {
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
    workflow.act(multi, "approved", "2026-09-29T00:00:00.000Z");

    await expect(workflow.apply(multi, "2026-09-29T00:00:01.000Z")).resolves.toEqual({ ok: true });
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
    workflow.act(multi, "approved", "2026-09-29T00:00:00.000Z");

    await expect(workflow.apply(multi, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
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
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");

    await expect(workflow.apply(proposal, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    expect(repo.getProposalStatus(proposal.id)).toBe("apply-failed");
  });

  it("appends ordered audit events for approve and apply transitions", async () => {
    const repo = await fixture();
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "See x", revision: "r" }),
      write: async () => undefined
    });
    workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z");
    await workflow.apply(proposal, "2026-09-29T00:00:01.000Z");

    const events = repo.listIntegrityEvents({ category: "audit" });
    expect(events.map((event) => event.kind)).toEqual([
      "proposal-approved",
      "apply-started",
      "apply-succeeded"
    ]);
    expect(events[0]).toMatchObject({
      proposalId: proposal.id,
      approvalId: `${proposal.id}:approved:2026-09-29T00:00:00.000Z`,
      occurredAt: "2026-09-29T00:00:00.000Z"
    });
    expect(events[1]).toMatchObject({ proposalId: proposal.id });
    expect(events[2]).toMatchObject({
      proposalId: proposal.id,
      approvalId: `${proposal.id}:applied:2026-09-29T00:00:01.000Z`
    });
  });

  it("rejects a non-ISO actedAt without mutating proposal state", async () => {
    const repo = await fixture();
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "See x", revision: "r" }),
      write: async () => undefined
    });
    expect(() => workflow.act(proposal, "approved", "not-a-date")).toThrow(
      "actedAt must be a round-trippable ISO timestamp"
    );
    expect(repo.getProposalStatus(proposal.id)).toBe("pending");
    expect(repo.listIntegrityEvents({ category: "audit" })).toHaveLength(0);
  });

  it("rolls back status and approval together when the audit event conflicts", async () => {
    const repo = await fixture();
    repo.appendIntegrityEvent({
      schemaVersion: 1,
      id: "conflicting-event",
      category: "operational",
      kind: "scan-started",
      occurredAt: "2026-09-29T00:00:00.000Z",
      scanId: "s",
      safeMetadata: {}
    });
    const workflow = new ReviewWorkflow(
      repo,
      { read: async () => ({ content: "See x", revision: "r" }), write: async () => undefined },
      () => "conflicting-event"
    );
    expect(() => workflow.act(proposal, "approved", "2026-09-29T00:00:00.000Z")).toThrow(
      "integrity event id conflict"
    );
    expect(repo.getProposalStatus(proposal.id)).toBe("pending");
    expect(repo.listIntegrityEvents({ category: "audit" })).toHaveLength(0);
  });

  it("emits apply-rolled-back only after compensation succeeds", async () => {
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
      write: async () => undefined,
      writeIfCurrent: async (path, before, next) => {
        if (contents.get(path) !== before) return false;
        if (path === "B.md" && next === "Y") throw new Error("disk full");
        contents.set(path, next);
        return true;
      }
    });
    workflow.act(multi, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(multi, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    expect(repo.listIntegrityEvents({ category: "audit" }).map((event) => event.kind)).toEqual([
      "proposal-approved",
      "apply-started",
      "apply-rolled-back"
    ]);
    expect(repo.getProposalStatus(multi.id)).toBe("apply-failed");
  });

  it("emits apply-recovery-required when compensation fails", async () => {
    const repo = await fixture();
    const multi: Proposal = {
      ...proposal,
      id: "recovery",
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
      write: async () => undefined,
      writeIfCurrent: async (path, before, next) => {
        if (contents.get(path) !== before) return false;
        if (path === "B.md") throw new Error("disk full");
        if (path === "A.md" && next === "x") throw new Error("disk full");
        contents.set(path, next);
        return true;
      }
    });
    workflow.act(multi, "approved", "2026-09-29T00:00:00.000Z");
    await expect(workflow.apply(multi, "2026-09-29T00:00:01.000Z")).resolves.toEqual({
      ok: false,
      reason: "write-failed"
    });
    expect(repo.getProposalStatus(multi.id)).toBe("recovery-required");
    expect(repo.listIntegrityEvents({ category: "audit" }).map((event) => event.kind)).toEqual([
      "proposal-approved",
      "apply-started",
      "apply-recovery-required"
    ]);
  });

  it("recovers interrupted applies with truthful events only for changed proposals", async () => {
    const repo = await fixture();
    repo.updateProposalStatus(proposal.id, "applying");
    const workflow = new ReviewWorkflow(repo, {
      read: async () => ({ content: "See x", revision: "r" }),
      write: async () => undefined
    });
    let reindexed = 0;
    expect(workflow.recoverInterruptedApplies(() => reindexed++)).toBe(1);
    expect(reindexed).toBe(1);
    expect(repo.getProposalStatus(proposal.id)).toBe("recovery-required");
    const events = repo.listIntegrityEvents({ category: "audit" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "apply-recovery-required", proposalId: proposal.id });
    expect(workflow.recoverInterruptedApplies(() => reindexed++)).toBe(0);
    expect(repo.listIntegrityEvents({ category: "audit" })).toHaveLength(1);
  });
});
