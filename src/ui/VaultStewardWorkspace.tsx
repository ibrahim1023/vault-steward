import { useEffect, useMemo, useState } from "react";

import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";
import type { FindingLifecycleRecord, ScanHistoryRecord } from "../storage/repositories.js";
import {
  activeDashboardFindings,
  selectDashboardFinding,
  selectNextBestAction
} from "./dashboard.js";
import { FindingDetail } from "./FindingDetail.js";
import { FindingExplanation } from "./FindingExplanation.js";
import { FindingFeedback } from "./FindingFeedback.js";
import { HistoryView } from "./HistoryView.js";
import { NextBestAction } from "./NextBestAction.js";
import { PluginStatusView, type PluginStatus } from "./PluginStatusView.js";
import { ModelReadinessView } from "./ModelReadinessView.js";
import { PriorityFindings } from "./PriorityFindings.js";
import { PolicyStudio } from "./PolicyStudio.js";
import { ProposalReviewPanel } from "./ProposalReviewPanel.js";
import { VaultHealthSummary } from "./VaultHealthSummary.js";

export function VaultStewardWorkspace({
  vaultLabel,
  scan,
  loadFindings,
  createProposal,
  reviewProposal,
  applyProposal,
  loadHistory,
  policyStudio,
  explainFinding,
  checkModelReadiness,
  submitFeedback
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
  policyStudio?: {
    loadDraft: () => Promise<string>;
    previewDraft: (source: string) => Promise<import("../policy/studio.js").PolicyPreview>;
    saveDraft: (source: string) => Promise<void>;
  };
  explainFinding?: (
    finding: Finding
  ) => Promise<import("../agents/finding-explanation.js").FindingExplanation>;
  checkModelReadiness?: () => Promise<import("../model-provider/readiness.js").ModelReadiness>;
  submitFeedback?: (
    finding: Finding,
    verdict: import("../feedback/review.js").FeedbackVerdict,
    label: string
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<PluginStatus>("ready");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [repairMessage, setRepairMessage] = useState<string>();
  const [target, setTarget] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [review, setReview] = useState<{
    proposal: Proposal;
    sources: Record<string, string>;
    status: "pending" | "approved" | "dismissed" | "deferred" | "applied" | "stale";
  }>();
  const history = loadHistory?.();
  const actionableFindings = activeDashboardFindings(findings);
  const selectedFinding = useMemo(
    () =>
      selectDashboardFinding(actionableFindings, selectedFindingId) ??
      selectNextBestAction(actionableFindings),
    [actionableFindings, selectedFindingId]
  );
  const lastCompletedAt = history?.scans.find((item) => item.status === "completed")?.finishedAt;

  useEffect(() => {
    if (!loadFindings) return;
    Promise.resolve(loadFindings())
      .then(setFindings)
      .catch(() => setErrorMessage("The persisted review queue is unavailable."));
  }, [loadFindings]);

  const runScan = async () => {
    setStatus("scanning");
    setErrorMessage(undefined);
    setRepairMessage(undefined);
    try {
      const result = await scan();
      setFindings(loadFindings ? await loadFindings() : result.findings);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(scanFailureMessage(error));
    }
  };

  const repairControls =
    selectedFinding?.type === "broken-reference" && createProposal ? (
      <div>
        <label>
          Reference target{" "}
          <input
            aria-label="Reference target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!target}
          onClick={() => {
            setRepairMessage(undefined);
            void createProposal(selectedFinding.id, target)
              .then(({ proposal, sources }) => setReview({ proposal, sources, status: "pending" }))
              .catch(() => setRepairMessage("A safe proposal could not be created."));
          }}
        >
          Prepare reference repair
        </button>
        {repairMessage ? <p role="alert">{repairMessage}</p> : null}
      </div>
    ) : null;

  return (
    <section className="vault-steward-dashboard" aria-label="Vault Steward workspace">
      <PluginStatusView
        vaultLabel={vaultLabel}
        status={status}
        {...(errorMessage ? { errorMessage } : {})}
      />
      <button type="button" onClick={runScan} disabled={status === "scanning"}>
        Run scan
      </button>
      <VaultHealthSummary
        vaultLabel={vaultLabel}
        findings={actionableFindings}
        {...(lastCompletedAt ? { lastCompletedAt } : {})}
      />
      <NextBestAction
        finding={selectNextBestAction(actionableFindings)}
        onOpen={setSelectedFindingId}
      />
      <PriorityFindings
        findings={actionableFindings}
        selectedFindingId={selectedFinding?.id}
        onSelect={setSelectedFindingId}
      />
      <FindingDetail finding={selectedFinding}>
        {repairControls}
        {selectedFinding && explainFinding ? (
          <FindingExplanation finding={selectedFinding} explain={explainFinding} />
        ) : null}
        {selectedFinding && submitFeedback ? (
          <FindingFeedback finding={selectedFinding} submit={submitFeedback} />
        ) : null}
      </FindingDetail>
      {policyStudio ? <PolicyStudio {...policyStudio} /> : null}
      {checkModelReadiness ? <ModelReadinessView checkReadiness={checkModelReadiness} /> : null}
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
      {history ? (
        <details>
          <summary>History</summary>
          <HistoryView scans={history.scans} lifecycle={history.lifecycle} />
        </details>
      ) : null}
    </section>
  );
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
