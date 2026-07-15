import type { Proposal } from "../contracts/proposal.js";
import type { VaultStewardRepository } from "../storage/repositories.js";

export type WritableVault = {
  read(path: string): Promise<{ content: string; revision: string }>;
  write(path: string, content: string): Promise<void>;
};
export type ReviewAction = "approved" | "dismissed" | "deferred";

export class ReviewWorkflow {
  constructor(
    private readonly repository: VaultStewardRepository,
    private readonly vault: WritableVault
  ) {}
  act(proposal: Proposal, action: ReviewAction, actedAt: string): void {
    const status = this.repository.getProposalStatus(proposal.id);
    if (status !== "pending") throw new Error("Only pending proposals can be reviewed.");
    this.repository.updateProposalStatus(proposal.id, action);
    this.repository.recordApproval({
      id: `${proposal.id}:${action}:${actedAt}`,
      proposalId: proposal.id,
      action,
      actedAt,
      appliedRevision: null
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
    const written: Array<{ path: string; content: string }> = [];
    try {
      for (const write of writes) {
        await this.vault.write(write.path, write.content);
        written.push({ path: write.path, content: write.before });
      }
    } catch {
      for (const write of [...written].reverse()) {
        try {
          await this.vault.write(write.path, write.content);
        } catch {
          // The persisted recovery-required state directs the user to re-index after a failed rollback.
        }
      }
      this.repository.updateProposalStatus(proposal.id, "apply-failed");
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

  recoverInterruptedApplies(onReindex: () => void): number {
    const recovered = this.repository.recoverInterruptedApplies();
    if (recovered > 0) onReindex();
    return recovered;
  }
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
