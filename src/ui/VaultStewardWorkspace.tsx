import { useEffect, useState } from "react";

import type { Finding } from "../contracts/index.js";
import { PluginStatusView, type PluginStatus } from "./PluginStatusView.js";
import { ReviewQueueView, type ReviewQueueStatus } from "./ReviewQueueView.js";
import { ProposalReviewPanel } from "./ProposalReviewPanel.js";
import type { Proposal } from "../contracts/proposal.js";

export function VaultStewardWorkspace({
  vaultLabel,
  scan,
  loadFindings,
  createProposal,
  reviewProposal,
  applyProposal
}: {
  vaultLabel: string;
  scan: () => Promise<{
    scanId: string;
    findings: Finding[];
    completed?: boolean;
    limitations?: string[];
  }>;
  loadFindings?: () => Promise<Finding[]> | Finding[];
  createProposal?: (
    findingId: string,
    target: string
  ) => Promise<{ proposal: Proposal; sources: Record<string, string> }>;
  reviewProposal?: (
    proposalId: string,
    action: "approved" | "dismissed" | "deferred"
  ) => Promise<void>;
  applyProposal?: (proposalId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
}) {
  const [status, setStatus] = useState<PluginStatus>("ready");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [target, setTarget] = useState("");
  const [review, setReview] = useState<{
    proposal: Proposal;
    sources: Record<string, string>;
    status: "pending" | "approved" | "dismissed" | "deferred" | "applied" | "stale";
  }>();

  useEffect(() => {
    if (!loadFindings) return;
    Promise.resolve(loadFindings())
      .then(setFindings)
      .catch(() => setErrorMessage("The persisted review queue is unavailable."));
  }, [loadFindings]);

  const runScan = async () => {
    setStatus("scanning");
    setErrorMessage(undefined);
    try {
      const result = await scan();
      setFindings(loadFindings ? await loadFindings() : result.findings);
      setStatus("ready");
    } catch {
      setFindings([]);
      setStatus("unavailable");
      setErrorMessage("The scan could not complete.");
    }
  };

  const reviewStatus: ReviewQueueStatus =
    status === "scanning" ? "scanning" : status === "unavailable" ? "error" : "ready";

  return (
    <section aria-label="Vault Steward workspace">
      <PluginStatusView vaultLabel={vaultLabel} status={status} />
      <button type="button" onClick={runScan} disabled={status === "scanning"}>
        Run scan
      </button>
      {status === "ready" ? <p>{findings.length} persisted findings loaded.</p> : null}
      <ReviewQueueView
        status={reviewStatus}
        findings={findings}
        {...(errorMessage ? { errorMessage } : {})}
      />
      {createProposal ? (
        <p>
          <label>
            Reference target{" "}
            <input value={target} onChange={(event) => setTarget(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={!target}
            onClick={() => {
              const finding = findings.find((item) => item.type === "broken-reference");
              if (finding)
                void createProposal(finding.id, target)
                  .then(({ proposal, sources }) =>
                    setReview({ proposal, sources, status: "pending" })
                  )
                  .catch(() => setErrorMessage("A safe proposal could not be created."));
            }}
          >
            Prepare reference repair
          </button>
        </p>
      ) : null}
      {review && reviewProposal && applyProposal ? (
        <ProposalReviewPanel
          proposal={review.proposal}
          sources={review.sources}
          status={review.status}
          onAction={async (id, action) => {
            await reviewProposal(id, action);
            setReview({ ...review, status: action });
          }}
          onApply={async (id) => {
            const result = await applyProposal(id);
            if (result.ok) setReview({ ...review, status: "applied" });
            return result;
          }}
        />
      ) : null}
    </section>
  );
}
