import { useState } from "react";

import type { Proposal } from "../contracts/proposal.js";
import { DiffPreview } from "./DiffPreview.js";

export type ProposalAction = "approved" | "dismissed" | "deferred";

export function ProposalReviewPanel({
  proposal,
  sources,
  status,
  onAction,
  onApply
}: {
  proposal: Proposal;
  sources: Readonly<Record<string, string>>;
  status: "pending" | "approved" | "dismissed" | "deferred" | "applied" | "stale";
  onAction: (proposalId: string, action: ProposalAction) => void | Promise<void>;
  onApply: (proposalId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<string | undefined>();
  const affectedNotes = new Set(proposal.operations.map((operation) => operation.path)).size;
  const apply = async () => {
    const result = await onApply(proposal.id);
    setConfirming(false);
    setOutcome(
      result.ok ? "Approved change applied." : `Apply could not complete: ${result.reason}.`
    );
  };
  return (
    <section aria-label="Proposal review">
      <h2>Proposed reference repair</h2>
      <p>{proposal.explanation}</p>
      <DiffPreview proposal={proposal} sources={sources} />
      {status === "pending" ? (
        <p>
          <button type="button" onClick={() => void onAction(proposal.id, "approved")}>
            Approve proposal
          </button>
          <button type="button" onClick={() => void onAction(proposal.id, "dismissed")}>
            Dismiss proposal
          </button>
          <button type="button" onClick={() => void onAction(proposal.id, "deferred")}>
            Defer proposal
          </button>
        </p>
      ) : null}
      {status === "approved" ? (
        <button type="button" onClick={() => setConfirming(true)}>
          Apply approved change
        </button>
      ) : null}
      {confirming ? (
        <dialog open aria-label="Apply this approved change?">
          <p>
            Apply this approved change to {affectedNotes} affected note
            {affectedNotes === 1 ? "" : "s"}?
          </p>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button type="button" onClick={() => void apply()}>
            Confirm apply
          </button>
        </dialog>
      ) : null}
      {outcome ? <p role="status">{outcome}</p> : null}
    </section>
  );
}
