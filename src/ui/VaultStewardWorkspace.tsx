import { useEffect, useState } from "react";

import type { Finding } from "../contracts/index.js";
import { PluginStatusView, type PluginStatus } from "./PluginStatusView.js";
import { ReviewQueueView, type ReviewQueueStatus } from "./ReviewQueueView.js";
import { ProposalReviewPanel } from "./ProposalReviewPanel.js";
import { HistoryView } from "./HistoryView.js";
import type { Proposal } from "../contracts/proposal.js";
import type { FindingLifecycleRecord, ScanHistoryRecord } from "../storage/repositories.js";

export function VaultStewardWorkspace({
  vaultLabel,
  scan,
  loadFindings,
  createProposal,
  reviewProposal,
  applyProposal,
  loadHistory
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
  loadHistory?: () => { scans: ScanHistoryRecord[]; lifecycle: FindingLifecycleRecord[] };
}) {
  const [status, setStatus] = useState<PluginStatus>("ready");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [repairMessage, setRepairMessage] = useState<string | undefined>();
  const [target, setTarget] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string | undefined>();
  const [review, setReview] = useState<{
    proposal: Proposal;
    sources: Record<string, string>;
    status: "pending" | "approved" | "dismissed" | "deferred" | "applied" | "stale";
  }>();
  const history = loadHistory?.();
  const brokenReferences = findings.filter((item) => item.type === "broken-reference");

  useEffect(() => {
    if (!loadFindings) return;
    Promise.resolve(loadFindings())
      .then(setFindings)
      .catch(() => setErrorMessage("The persisted review queue is unavailable."));
  }, [loadFindings]);

  useEffect(() => {
    if (!brokenReferences.some((finding) => finding.id === selectedFindingId)) {
      setSelectedFindingId(brokenReferences[0]?.id);
    }
  }, [brokenReferences, selectedFindingId]);

  const runScan = async () => {
    setStatus("scanning");
    setErrorMessage(undefined);
    setRepairMessage(undefined);
    try {
      const result = await scan();
      setFindings(loadFindings ? await loadFindings() : result.findings);
      setStatus("ready");
    } catch (error) {
      setFindings([]);
      setStatus("error");
      setErrorMessage(scanFailureMessage(error));
    }
  };

  const reviewStatus: ReviewQueueStatus =
    status === "scanning" ? "scanning" : status === "error" ? "error" : "ready";

  return (
    <section aria-label="Vault Steward workspace">
      <PluginStatusView
        vaultLabel={vaultLabel}
        status={status}
        {...(errorMessage ? { errorMessage } : {})}
      />
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
        <div>
          <label>
            Reference finding{" "}
            <select
              aria-label="Reference finding"
              value={selectedFindingId ?? ""}
              onChange={(event) => setSelectedFindingId(event.target.value || undefined)}
              disabled={brokenReferences.length === 0}
            >
              {brokenReferences.length === 0 ? (
                <option value="">Run a successful scan with a broken reference</option>
              ) : (
                brokenReferences.map((finding) => (
                  <option key={finding.id} value={finding.id}>
                    {referenceFindingLabel(finding)}
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            Reference target{" "}
            <input value={target} onChange={(event) => setTarget(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={!target || !selectedFindingId}
            onClick={() => {
              const finding = brokenReferences.find((item) => item.id === selectedFindingId);
              if (!finding) {
                setRepairMessage(
                  "Run a successful scan and select a broken-reference finding before preparing a repair."
                );
                return;
              }
              setRepairMessage(undefined);
              void createProposal(finding.id, target)
                .then(({ proposal, sources }) =>
                  setReview({ proposal, sources, status: "pending" })
                )
                .catch(() => setRepairMessage("A safe proposal could not be created."));
            }}
          >
            Prepare reference repair
          </button>
          {repairMessage ? <p role="alert">{repairMessage}</p> : null}
        </div>
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
      {history ? <HistoryView scans={history.scans} lifecycle={history.lifecycle} /> : null}
    </section>
  );
}

function referenceFindingLabel(finding: Finding): string {
  const evidence = finding.evidence[0];
  return evidence ? `${evidence.notePath} (${evidence.locator}): ${evidence.excerpt}` : finding.id;
}

function scanFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("local model semantic analysis"))
    return "Local model analysis did not complete. Check Ollama and the configured model.";
  if (message.includes("Vault reader") || message.includes("vault read"))
    return "The active vault could not be read.";
  if (message.includes("database")) return "The local Vault Steward database is unavailable.";
  return "The scan could not complete.";
}
