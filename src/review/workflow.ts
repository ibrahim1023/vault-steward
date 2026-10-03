import { randomUUID } from "node:crypto";

import { proposalDigest, type Proposal } from "../contracts/proposal.js";
import type { NewIntegrityEvent } from "../contracts/integrity-event.js";
import type { ApprovalRecord, VaultStewardRepository } from "../storage/repositories.js";

export type WritableVault = {
  read(path: string): Promise<{ content: string; revision: string }>;
  write(path: string, content: string): Promise<void>;
  writeIfCurrent?(path: string, before: string, content: string): Promise<boolean>;
};
export type ReviewAction = "approved" | "dismissed" | "deferred";
export type BatchApplyFailureReason =
  "invalid" | "stale" | "write-failed" | "recovery-required" | "canceled";
export type BatchApplyResult = {
  ok: boolean;
  reason?: BatchApplyFailureReason;
  appliedProposalIds: string[];
  skippedProposalIds: string[];
  failedProposalIds: string[];
  notesEdited: number;
  reindexed: boolean;
};

export class ReviewWorkflow {
  constructor(
    private readonly repository: VaultStewardRepository,
    private readonly vault: WritableVault,
    private readonly createEventId: () => string = randomUUID
  ) {}
  act(proposal: Proposal, action: ReviewAction, actedAt: string): void {
    const digest = this.requireCurrentDigest(proposal);
    const status = this.repository.getProposalStatus(proposal.id);
    if (status !== "pending") throw new Error("Only pending proposals can be reviewed.");
    const approvalId = `${proposal.id}:${action}:${actedAt}`;
    this.transitionWithApproval(
      proposal.id,
      action,
      {
        id: approvalId,
        proposalId: proposal.id,
        action,
        actedAt,
        appliedRevision: null,
        proposalDigest: digest
      },
      this.auditEvent(`proposal-${action}`, actedAt, {
        proposalId: proposal.id,
        approvalId
      })
    );
  }
  async apply(
    proposal: Proposal,
    actedAt: string,
    options: { signal?: AbortSignal; onReindex?: () => void } = {}
  ): Promise<{ ok: true } | { ok: false; reason: "stale" | "write-failed" | "canceled" }> {
    if (this.repository.getProposalStatus(proposal.id) !== "approved")
      throw new Error("Only approved proposals can be applied.");
    if (options.signal?.aborted) return { ok: false, reason: "canceled" };
    assertValidActedAt(actedAt);
    const digest = this.requireCurrentDigest(proposal);
    if (this.repository.getApprovedProposalDigest(proposal.id) !== digest) {
      this.transitionStatus(
        proposal.id,
        "stale",
        this.auditEvent("proposal-stale", actedAt, { proposalId: proposal.id })
      );
      return { ok: false, reason: "stale" };
    }
    this.transitionStatus(
      proposal.id,
      "applying",
      this.auditEvent("apply-started", actedAt, { proposalId: proposal.id })
    );
    let current: Array<{
      operation: Proposal["operations"][number];
      file: { content: string; revision: string };
    }>;
    try {
      current = await Promise.all(
        proposal.operations.map(async (operation) => ({
          operation,
          file: await this.vault.read(operation.path)
        }))
      );
    } catch {
      this.transitionStatus(
        proposal.id,
        "apply-failed",
        this.auditEvent("apply-failed", actedAt, { proposalId: proposal.id })
      );
      return { ok: false, reason: "write-failed" };
    }
    if (
      current.some(
        ({ operation, file }) =>
          file.revision !== operation.sourceRevision ||
          file.content.slice(operation.start, operation.end) !== operation.expected
      )
    ) {
      const approvalId = `${proposal.id}:stale:${actedAt}`;
      this.transitionWithApproval(
        proposal.id,
        "stale",
        {
          id: approvalId,
          proposalId: proposal.id,
          action: "stale",
          actedAt,
          appliedRevision: null
        },
        this.auditEvent("proposal-stale", actedAt, {
          proposalId: proposal.id,
          approvalId
        })
      );
      return { ok: false, reason: "stale" };
    }
    if (options.signal?.aborted) {
      this.repository.updateProposalStatus(proposal.id, "approved");
      return { ok: false, reason: "canceled" };
    }
    let writes: Array<{ path: string; before: string; content: string }>;
    try {
      writes = createWrites(current);
    } catch {
      this.transitionStatus(
        proposal.id,
        "apply-failed",
        this.auditEvent("apply-failed", actedAt, { proposalId: proposal.id })
      );
      return { ok: false, reason: "write-failed" };
    }
    const written: Array<{ path: string; before: string; after: string }> = [];
    try {
      for (const write of writes) {
        if (!(await this.writeIfCurrent(write))) throw new Error("stale write boundary");
        written.push({ path: write.path, before: write.before, after: write.content });
      }
    } catch {
      const rollbackFailed = await this.rollbackWrites(written);
      if (rollbackFailed) {
        this.transitionStatus(
          proposal.id,
          "recovery-required",
          this.auditEvent("apply-recovery-required", actedAt, { proposalId: proposal.id })
        );
      } else {
        this.transitionStatus(
          proposal.id,
          "apply-failed",
          this.auditEvent("apply-rolled-back", actedAt, { proposalId: proposal.id })
        );
      }
      return { ok: false, reason: "write-failed" };
    }
    const approvalId = `${proposal.id}:applied:${actedAt}`;
    this.transitionWithApproval(
      proposal.id,
      "applied",
      {
        id: approvalId,
        proposalId: proposal.id,
        action: "applied",
        actedAt,
        appliedRevision: null
      },
      this.auditEvent("apply-succeeded", actedAt, {
        proposalId: proposal.id,
        approvalId
      })
    );
    options.onReindex?.();
    return { ok: true };
  }

  async approveAndApplyBatch(
    proposals: readonly Proposal[],
    actedAt: string,
    options: { signal?: AbortSignal; onReindex?: () => void | Promise<void> } = {}
  ): Promise<BatchApplyResult> {
    const proposalIds = proposals.map((proposal) => proposal.id);
    const invalid = (): BatchApplyResult => batchFailure("invalid", [], proposalIds, []);
    if (
      proposals.length === 0 ||
      proposals.length > 20 ||
      new Set(proposalIds).size !== proposals.length ||
      new Set(proposals.map((proposal) => proposal.findingId)).size !== proposals.length ||
      new Set(proposals.map((proposal) => proposal.scanId)).size !== 1 ||
      hasOverlappingOperations(proposals.flatMap((proposal) => proposal.operations))
    )
      return invalid();

    const digests = new Map<string, string>();
    for (const proposal of proposals) {
      const record = this.repository.findProposal(proposal.id);
      const digest = proposalDigest(proposal);
      if (
        !record ||
        record.findingId !== proposal.findingId ||
        record.status !== "pending" ||
        record.proposalDigest !== digest
      )
        return invalid();
      digests.set(proposal.id, digest);
    }
    if (options.signal?.aborted) return batchFailure("canceled", [], proposalIds, []);
    assertValidActedAt(actedAt);

    for (const proposal of proposals) {
      const digest = digests.get(proposal.id)!;
      const approvalId = `${proposal.id}:approved:${actedAt}`;
      this.transitionWithApproval(
        proposal.id,
        "approved",
        {
          id: approvalId,
          proposalId: proposal.id,
          action: "approved",
          actedAt,
          appliedRevision: null,
          proposalDigest: digest
        },
        this.auditEvent("proposal-approved", actedAt, {
          proposalId: proposal.id,
          approvalId
        })
      );
    }

    const paths = [
      ...new Set(
        proposals.flatMap((proposal) => proposal.operations.map((operation) => operation.path))
      )
    ];
    const files = new Map<string, { content: string; revision: string }>();
    try {
      await Promise.all(
        paths.map(async (path) => {
          files.set(path, await this.vault.read(path));
        })
      );
    } catch {
      this.transitionBatch(proposals, "apply-failed", "apply-failed", actedAt);
      return batchFailure("write-failed", [], [], proposalIds);
    }

    const current = proposals.flatMap((proposal) =>
      proposal.operations.map((operation) => ({
        operation,
        file: files.get(operation.path)!
      }))
    );
    if (
      current.some(
        ({ operation, file }) =>
          file.revision !== operation.sourceRevision ||
          file.content.slice(operation.start, operation.end) !== operation.expected
      )
    ) {
      for (const proposal of proposals) {
        const approvalId = `${proposal.id}:stale:${actedAt}`;
        this.transitionWithApproval(
          proposal.id,
          "stale",
          {
            id: approvalId,
            proposalId: proposal.id,
            action: "stale",
            actedAt,
            appliedRevision: null
          },
          this.auditEvent("proposal-stale", actedAt, {
            proposalId: proposal.id,
            approvalId
          })
        );
      }
      return batchFailure("stale", [], proposalIds, []);
    }
    if (options.signal?.aborted) {
      this.updateBatchStatus(proposals, "approved");
      return batchFailure("canceled", [], proposalIds, []);
    }

    let writes: Array<{ path: string; before: string; content: string }>;
    try {
      writes = createWrites(current);
    } catch {
      this.transitionBatch(proposals, "stale", "proposal-stale", actedAt);
      return batchFailure("invalid", [], proposalIds, []);
    }
    this.transitionBatch(proposals, "applying", "apply-started", actedAt);

    const written: Array<{ path: string; before: string; after: string }> = [];
    try {
      for (const write of writes) {
        if (!(await this.writeIfCurrent(write))) throw new Error("stale write boundary");
        written.push({ path: write.path, before: write.before, after: write.content });
      }
    } catch {
      const rollbackFailed = await this.rollbackWrites(written);
      if (rollbackFailed) {
        this.transitionBatch(proposals, "recovery-required", "apply-recovery-required", actedAt);
      } else {
        this.transitionBatch(proposals, "apply-failed", "apply-rolled-back", actedAt);
      }
      return batchFailure(
        rollbackFailed ? "recovery-required" : "write-failed",
        [],
        [],
        proposalIds
      );
    }

    for (const proposal of proposals) {
      const approvalId = `${proposal.id}:applied:${actedAt}`;
      this.transitionWithApproval(
        proposal.id,
        "applied",
        {
          id: approvalId,
          proposalId: proposal.id,
          action: "applied",
          actedAt,
          appliedRevision: null
        },
        this.auditEvent("apply-succeeded", actedAt, {
          proposalId: proposal.id,
          approvalId
        })
      );
    }
    let reindexed = false;
    try {
      await options.onReindex?.();
      reindexed = options.onReindex !== undefined;
    } catch {
      reindexed = false;
    }
    return {
      ok: true,
      appliedProposalIds: proposalIds,
      skippedProposalIds: [],
      failedProposalIds: [],
      notesEdited: writes.length,
      reindexed
    };
  }

  recoverInterruptedApplies(onReindex: () => void): number {
    const proposalIds = this.repository.listRecoverableApplyProposalIds();
    const occurredAt = new Date().toISOString();
    for (const proposalId of proposalIds) {
      this.repository.withTransaction(() => {
        this.repository.updateProposalStatus(proposalId, "recovery-required");
        this.repository.appendIntegrityEvent(
          this.auditEvent("apply-recovery-required", occurredAt, { proposalId })
        );
      });
    }
    if (proposalIds.length > 0) onReindex();
    return proposalIds.length;
  }

  private requireCurrentDigest(proposal: Proposal): string {
    const digest = proposalDigest(proposal);
    if (this.repository.findProposal(proposal.id)?.proposalDigest !== digest) {
      throw new Error("Proposal integrity validation failed.");
    }
    return digest;
  }

  private updateBatchStatus(proposals: readonly Proposal[], status: string): void {
    for (const proposal of proposals) this.repository.updateProposalStatus(proposal.id, status);
  }

  private transitionBatch(
    proposals: readonly Proposal[],
    status: string,
    kind:
      | "apply-started"
      | "apply-succeeded"
      | "apply-failed"
      | "apply-rolled-back"
      | "apply-recovery-required"
      | "proposal-stale",
    actedAt: string
  ): void {
    for (const proposal of proposals) {
      this.transitionStatus(
        proposal.id,
        status,
        this.auditEvent(kind, actedAt, { proposalId: proposal.id })
      );
    }
  }

  private transitionStatus(proposalId: string, status: string, event: NewIntegrityEvent): void {
    this.repository.withTransaction(() => {
      this.repository.updateProposalStatus(proposalId, status);
      this.repository.appendIntegrityEvent(event);
    });
  }

  private transitionWithApproval(
    proposalId: string,
    status: string,
    approval: ApprovalRecord,
    event: NewIntegrityEvent
  ): void {
    this.repository.withTransaction(() => {
      this.repository.updateProposalStatus(proposalId, status);
      this.repository.recordApproval(approval);
      this.repository.appendIntegrityEvent(event);
    });
  }

  private auditEvent(
    kind:
      | "proposal-approved"
      | "proposal-dismissed"
      | "proposal-deferred"
      | "proposal-stale"
      | "apply-started"
      | "apply-succeeded"
      | "apply-failed"
      | "apply-rolled-back"
      | "apply-recovery-required",
    occurredAt: string,
    references: { proposalId: string; approvalId?: string }
  ): NewIntegrityEvent {
    assertValidActedAt(occurredAt);
    return {
      schemaVersion: 1,
      id: this.createEventId(),
      category: "audit",
      kind,
      occurredAt,
      proposalId: references.proposalId,
      ...(references.approvalId !== undefined ? { approvalId: references.approvalId } : {}),
      safeMetadata: {}
    };
  }

  private async writeIfCurrent(write: {
    path: string;
    before: string;
    content: string;
  }): Promise<boolean> {
    if (this.vault.writeIfCurrent)
      return this.vault.writeIfCurrent(write.path, write.before, write.content);
    await this.vault.write(write.path, write.content);
    return true;
  }

  private async rollbackWrites(
    writes: ReadonlyArray<{ path: string; before: string; after: string }>
  ): Promise<boolean> {
    if (!this.vault.writeIfCurrent) return writes.length > 0;
    let rollbackFailed = false;
    for (const write of [...writes].reverse()) {
      try {
        if (!(await this.vault.writeIfCurrent(write.path, write.after, write.before)))
          rollbackFailed = true;
      } catch {
        rollbackFailed = true;
      }
    }
    return rollbackFailed;
  }
}

function batchFailure(
  reason: BatchApplyFailureReason,
  appliedProposalIds: string[],
  skippedProposalIds: string[],
  failedProposalIds: string[]
): BatchApplyResult {
  return {
    ok: false,
    reason,
    appliedProposalIds,
    skippedProposalIds,
    failedProposalIds,
    notesEdited: 0,
    reindexed: false
  };
}

function assertValidActedAt(actedAt: string): void {
  let roundTripped: string;
  try {
    roundTripped = new Date(actedAt).toISOString();
  } catch {
    throw new Error("actedAt must be a round-trippable ISO timestamp");
  }
  if (roundTripped !== actedAt) {
    throw new Error("actedAt must be a round-trippable ISO timestamp");
  }
}

function hasOverlappingOperations(operations: readonly Proposal["operations"][number][]): boolean {
  const byPath = new Map<string, Proposal["operations"]>();
  for (const operation of operations)
    byPath.set(operation.path, [...(byPath.get(operation.path) ?? []), operation]);
  return [...byPath.values()].some((items) => {
    const sorted = [...items].sort(
      (left, right) => left.start - right.start || left.end - right.end
    );
    return sorted.slice(1).some((operation, index) => operation.start < sorted[index]!.end);
  });
}

function createWrites(
  current: ReadonlyArray<{
    operation: Proposal["operations"][number];
    file: { content: string; revision: string };
  }>
): Array<{ path: string; before: string; content: string }> {
  const byPath = new Map<string, typeof current>();
  for (const item of current)
    byPath.set(item.operation.path, [...(byPath.get(item.operation.path) ?? []), item]);
  return [...byPath.entries()].map(([path, items]) => {
    const before = items[0]!.file.content;
    const ascending = [...items].sort(
      (left, right) => left.operation.start - right.operation.start
    );
    for (let index = 1; index < ascending.length; index += 1) {
      if (ascending[index]!.operation.start < ascending[index - 1]!.operation.end) {
        throw new Error(`Overlapping operations for ${path} cannot be applied.`);
      }
    }
    const descending = [...items].sort(
      (left, right) => right.operation.start - left.operation.start
    );
    const content = descending.reduce(
      (next, { operation }) =>
        `${next.slice(0, operation.start)}${operation.replacement}${next.slice(operation.end)}`,
      before
    );
    return { path, before, content };
  });
}
