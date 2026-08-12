import { proposalDigest, type Proposal } from "../contracts/proposal.js";
import type { VaultStewardRepository } from "../storage/repositories.js";

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
    private readonly vault: WritableVault
  ) {}
  act(proposal: Proposal, action: ReviewAction, actedAt: string): void {
    const digest = this.requireCurrentDigest(proposal);
    const status = this.repository.getProposalStatus(proposal.id);
    if (status !== "pending") throw new Error("Only pending proposals can be reviewed.");
    this.repository.updateProposalStatus(proposal.id, action);
    this.repository.recordApproval({
      id: `${proposal.id}:${action}:${actedAt}`,
      proposalId: proposal.id,
      action,
      actedAt,
      appliedRevision: null,
      proposalDigest: digest
    });
  }
  async apply(
    proposal: Proposal,
    actedAt: string,
    options: { signal?: AbortSignal; onReindex?: () => void } = {}
  ): Promise<{ ok: true } | { ok: false; reason: "stale" | "write-failed" | "canceled" }> {
    if (this.repository.getProposalStatus(proposal.id) !== "approved")
      throw new Error("Only approved proposals can be applied.");
    if (options.signal?.aborted) return { ok: false, reason: "canceled" };
    const digest = this.requireCurrentDigest(proposal);
    if (this.repository.getApprovedProposalDigest(proposal.id) !== digest) {
      this.repository.updateProposalStatus(proposal.id, "stale");
      return { ok: false, reason: "stale" };
    }
    this.repository.updateProposalStatus(proposal.id, "applying");
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
      this.repository.updateProposalStatus(proposal.id, "apply-failed");
      return { ok: false, reason: "write-failed" };
    }
    if (
      current.some(
        ({ operation, file }) =>
          file.revision !== operation.sourceRevision ||
          file.content.slice(operation.start, operation.end) !== operation.expected
      )
    ) {
      this.repository.updateProposalStatus(proposal.id, "stale");
      this.repository.recordApproval({
        id: `${proposal.id}:stale:${actedAt}`,
        proposalId: proposal.id,
        action: "stale",
        actedAt,
        appliedRevision: null
      });
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
      this.repository.updateProposalStatus(proposal.id, "apply-failed");
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
      this.repository.updateProposalStatus(
        proposal.id,
        rollbackFailed ? "recovery-required" : "apply-failed"
      );
      return { ok: false, reason: "write-failed" };
    }
    this.repository.updateProposalStatus(proposal.id, "applied");
    this.repository.recordApproval({
      id: `${proposal.id}:applied:${actedAt}`,
      proposalId: proposal.id,
      action: "applied",
      actedAt,
      appliedRevision: null
    });
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

    for (const proposal of proposals) {
      const digest = digests.get(proposal.id)!;
      this.repository.updateProposalStatus(proposal.id, "approved");
      this.repository.recordApproval({
        id: `${proposal.id}:approved:${actedAt}`,
        proposalId: proposal.id,
        action: "approved",
        actedAt,
        appliedRevision: null,
        proposalDigest: digest
      });
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
      this.updateBatchStatus(proposals, "apply-failed");
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
      this.updateBatchStatus(proposals, "stale");
      for (const proposal of proposals) {
        this.repository.recordApproval({
          id: `${proposal.id}:stale:${actedAt}`,
          proposalId: proposal.id,
          action: "stale",
          actedAt,
          appliedRevision: null
        });
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
      this.updateBatchStatus(proposals, "stale");
      return batchFailure("invalid", [], proposalIds, []);
    }
    this.updateBatchStatus(proposals, "applying");

    const written: Array<{ path: string; before: string; after: string }> = [];
    try {
      for (const write of writes) {
        if (!(await this.writeIfCurrent(write))) throw new Error("stale write boundary");
        written.push({ path: write.path, before: write.before, after: write.content });
      }
    } catch {
      const rollbackFailed = await this.rollbackWrites(written);
      this.updateBatchStatus(proposals, rollbackFailed ? "recovery-required" : "apply-failed");
      return batchFailure(
        rollbackFailed ? "recovery-required" : "write-failed",
        [],
        [],
        proposalIds
      );
    }

    this.updateBatchStatus(proposals, "applied");
    for (const proposal of proposals) {
      this.repository.recordApproval({
        id: `${proposal.id}:applied:${actedAt}`,
        proposalId: proposal.id,
        action: "applied",
        actedAt,
        appliedRevision: null
      });
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
    const recovered = this.repository.recoverInterruptedApplies();
    if (recovered > 0) onReindex();
    return recovered;
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
