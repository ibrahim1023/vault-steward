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
    const current = await Promise.all(
      proposal.operations.map(async (operation) => ({
        operation,
        file: await this.vault.read(operation.path)
      }))
    );
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
    try {
      for (const { operation, file } of current)
        await this.vault.write(
          operation.path,
          `${file.content.slice(0, operation.start)}${operation.replacement}${file.content.slice(operation.end)}`
        );
    } catch {
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

  recoverInterruptedApplies(): number {
    return this.repository.recoverInterruptedApplies();
  }
}
