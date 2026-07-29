import { useEffect, useState } from "react";

import type { Finding } from "../contracts/index.js";
import type { PreparedRepairBatch } from "../contracts/prepared-repair.js";
import type { PreparedReferenceRepair } from "../review/prepare-repair-batch.js";
import type { BatchApplyResult } from "../review/workflow.js";
import type {
  FindingLifecycleRecord,
  ObservabilitySnapshot,
  ScanHistoryRecord
} from "../storage/repositories.js";
import { HistoryView } from "./HistoryView.js";
import { MaintenanceScheduleView } from "./MaintenanceScheduleView.js";
import { MaintenanceView } from "./MaintenanceView.js";
import { ModelReadinessView } from "./ModelReadinessView.js";
import { MoreTools } from "./MoreTools.js";
import { ObservabilityView } from "./ObservabilityView.js";
import { PolicyStudio } from "./PolicyStudio.js";
import { rankDashboardFindings } from "./dashboard.js";

type WorkspaceMode =
  "ready" | "scanning" | "recommendation" | "applying" | "result" | "judgment" | "error";

export function VaultStewardWorkspace({
  vaultLabel,
  scan,
  loadFindings,
  prepareRepairs,
  applyRepairs,
  openNote,
  markNotImportant,
  openProviderSettings,
  loadHistory,
  policyStudio,
  checkModelReadiness,
  maintenance,
  inspectImpact,
  loadObservability,
  deleteScanTrace,
  deleteAllTraceData
}: {
  vaultLabel: string;
  scan: () => Promise<{
    scanId: string;
    findings: Finding[];
    completed?: boolean;
    limitations?: string[];
  }>;
  loadFindings?: () => Promise<Finding[]> | Finding[];
  prepareRepairs?: () => Promise<PreparedReferenceRepair | null>;
  applyRepairs?: (batch: PreparedRepairBatch) => Promise<BatchApplyResult>;
  openNote?: (path: string) => void | Promise<void>;
  markNotImportant?: (finding: Finding) => Promise<void>;
  openProviderSettings?: () => void;
  loadHistory?: () => { scans: ScanHistoryRecord[]; lifecycle: FindingLifecycleRecord[] };
  policyStudio?: {
    loadDraft: () => Promise<string>;
    previewDraft: (source: string) => Promise<import("../policy/studio.js").PolicyPreview>;
    saveDraft: (source: string) => Promise<void>;
  };
  checkModelReadiness?: () => Promise<import("../model-provider/readiness.js").ModelReadiness>;
  maintenance?: {
    schedule: import("../maintenance/scheduler.js").MaintenanceSchedule;
    state: import("../maintenance/scheduler.js").MaintenanceScheduleState;
    setPaused: (paused: boolean) => Promise<void>;
  };
  inspectImpact?: (path: string) => import("../indexing/impact.js").ChangeImpact;
  loadObservability?: (scanId?: string) => ObservabilitySnapshot;
  deleteScanTrace?: (scanId: string) => Promise<void>;
  deleteAllTraceData?: () => Promise<void>;
}) {
  const [mode, setMode] = useState<WorkspaceMode>("ready");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [prepared, setPrepared] = useState<PreparedReferenceRepair | null>(null);
  const [actualResult, setActualResult] = useState<BatchApplyResult | null>(null);
  const [judgment, setJudgment] = useState<Finding>();
  const [dismissedFindingIds, setDismissedFindingIds] = useState<Set<string>>(() => new Set());
  const [dismissing, setDismissing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const history = loadHistory?.();
  const activeFindings = rankDashboardFindings(
    findings.filter((finding) => finding.status === "open" && !dismissedFindingIds.has(finding.id))
  );

  useEffect(() => {
    if (!loadFindings) return;
    Promise.resolve(loadFindings())
      .then(setFindings)
      .catch(() => setErrorMessage("The saved issue list is unavailable."));
  }, [loadFindings]);

  const chooseNext = async (
    nextFindings: Finding[],
    dismissedIds: ReadonlySet<string> = dismissedFindingIds,
    includeRepairRecommendation = true
  ) => {
    const active = rankDashboardFindings(
      nextFindings.filter((finding) => finding.status === "open" && !dismissedIds.has(finding.id))
    );
    let nextPrepared: PreparedReferenceRepair | null = null;
    if (includeRepairRecommendation) {
      try {
        nextPrepared = prepareRepairs ? await prepareRepairs() : null;
      } catch {
        // A repair recommendation is optional. Keep the review loop usable when
        // the provider cannot rank a bounded repair candidate.
        nextPrepared = null;
      }
    }
    if (nextPrepared) {
      setPrepared(nextPrepared);
      setJudgment(undefined);
      setMode("recommendation");
      return;
    }
    setPrepared(null);
    if (active[0]) {
      setJudgment(active[0]);
      setMode("judgment");
      return;
    }
    setJudgment(undefined);
    setActualResult(null);
    setMode("result");
  };

  const checkVault = async () => {
    setMode("scanning");
    setErrorMessage(undefined);
    try {
      const result = await scan();
      const nextFindings = loadFindings ? await loadFindings() : result.findings;
      setFindings(nextFindings);
      await chooseNext(nextFindings);
    } catch (error) {
      setMode("error");
      setErrorMessage(scanFailureMessage(error));
    }
  };

  const applyPrepared = async () => {
    if (!prepared || !applyRepairs) {
      setMode("error");
      setErrorMessage("Applying fixes is unavailable. Check the plugin installation.");
      return;
    }
    setMode("applying");
    setErrorMessage(undefined);
    try {
      const result = await applyRepairs(prepared.batch);
      if (!result.ok) {
        setMode("error");
        setErrorMessage(batchFailureMessage(result.reason));
        return;
      }
      setActualResult(result);
      setMode("result");
      if (loadFindings) setFindings(await loadFindings());
    } catch {
      setMode("error");
      setErrorMessage("The approved fixes could not be applied. Your notes were not changed.");
    }
  };

  const reviewNext = async () => {
    setErrorMessage(undefined);
    try {
      const nextFindings = loadFindings
        ? await loadFindings()
        : findings.filter((finding) => !prepared?.batch.findingIds.includes(finding.id));
      setFindings(nextFindings);
      await chooseNext(nextFindings);
    } catch {
      setMode("error");
      setErrorMessage("The next issue could not be prepared. Check the vault again.");
    }
  };

  const dismissJudgment = async (finding: Finding) => {
    if (dismissing) return;
    setDismissing(true);
    setErrorMessage(undefined);
    try {
      await markNotImportant?.(finding);
      const nextDismissedIds = new Set(dismissedFindingIds);
      nextDismissedIds.add(finding.id);
      setDismissedFindingIds(nextDismissedIds);
      await chooseNext(findings, nextDismissedIds, false);
    } catch {
      setMode("error");
      setErrorMessage("This issue could not be marked as unimportant. Try again.");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <section className="vault-steward" aria-label="Vault Steward workspace">
      <header className="steward-header">
        <div>
          <h1>Vault Steward</h1>
          <p>{vaultLabel}</p>
        </div>
        <span className="steward-local">Local-first review</span>
      </header>

      {mode === "ready" ? (
        <section className="steward-start" aria-label="Ready to check">
          <h2>Keep your vault trustworthy</h2>
          <p>
            Check links, tasks, decisions, and note consistency. Vault Steward prepares the clearest
            next action for you.
          </p>
          {activeFindings.length > 0 ? (
            <p className="last-check">
              Last check: {formatCount(activeFindings.length, "issue")} still needs attention.
            </p>
          ) : null}
          <button className="steward-primary" type="button" onClick={checkVault}>
            Check vault
          </button>
        </section>
      ) : null}

      {mode === "scanning" ? (
        <section className="steward-progress" aria-label="Checking vault">
          <p role="status" aria-live="polite">
            Checking your vault and preparing the best next action...
          </p>
          <button className="steward-primary" type="button" disabled>
            Check vault
          </button>
        </section>
      ) : null}

      {prepared && (mode === "recommendation" || mode === "applying") ? (
        <PreparedResult
          prepared={prepared}
          applying={mode === "applying"}
          onApply={applyPrepared}
        />
      ) : null}

      {mode === "applying" ? (
        <p className="applying-status" role="status" aria-live="polite">
          Applying approved fixes and checking the vault again...
        </p>
      ) : null}

      {mode === "result" ? (
        <ResultView result={actualResult} onNext={actualResult ? reviewNext : checkVault} />
      ) : null}

      {mode === "judgment" && judgment ? (
        <JudgmentView
          finding={judgment}
          {...(openNote ? { openNote } : {})}
          dismissing={dismissing}
          onNotImportant={dismissJudgment}
        />
      ) : null}

      {mode === "error" && errorMessage ? (
        <section className="steward-error" aria-label="Action needed">
          <p role="alert">{errorMessage}</p>
          <button className="steward-primary" type="button" onClick={checkVault}>
            Check vault again
          </button>
        </section>
      ) : null}

      <IssueList findings={activeFindings} />

      <MoreTools>
        {openProviderSettings ? (
          <button type="button" onClick={openProviderSettings}>
            Provider settings
          </button>
        ) : null}
        {checkModelReadiness ? <ModelReadinessView checkReadiness={checkModelReadiness} /> : null}
        {policyStudio ? <PolicyStudio {...policyStudio} /> : null}
        {maintenance ? <MaintenanceScheduleView {...maintenance} /> : null}
        {inspectImpact ? (
          <MaintenanceView findings={findings} inspectImpact={inspectImpact} />
        ) : null}
        {history ? (
          <details>
            <summary>History</summary>
            <HistoryView scans={history.scans} lifecycle={history.lifecycle} />
          </details>
        ) : null}
        {history && loadObservability ? (
          <ObservabilityView
            scans={history.scans}
            loadObservability={loadObservability}
            {...(judgment ? { selectedFindingId: judgment.id } : {})}
            {...(deleteScanTrace ? { deleteScanTrace } : {})}
            {...(deleteAllTraceData ? { deleteAllTraceData } : {})}
          />
        ) : null}
      </MoreTools>
    </section>
  );
}

function PreparedResult({
  prepared,
  applying,
  onApply
}: {
  prepared: PreparedReferenceRepair;
  applying: boolean;
  onApply: () => Promise<void>;
}) {
  const count = prepared.batch.proposalIds.length;
  return (
    <section className="prepared-result" aria-label="Prepared result">
      <div className="prepared-heading">
        <div>
          <p className="steward-eyebrow">Ready for your approval</p>
          <h2>{formatCount(count, "safe fix")} prepared</h2>
        </div>
        <span className="target-status">Evidence checked</span>
      </div>
      <p className="prepared-intro">
        Review the exact result below. Vault Steward will apply only these changes.
      </p>
      <div className="repair-items">
        {prepared.items.map((item) => (
          <article className="repair-item" key={item.proposalId}>
            <div className="repair-source">
              <strong>{item.sourcePath}</strong>
              <span>{item.locator}</span>
            </div>
            <p className="target-status">
              {item.targetStatus === "verified-rename"
                ? "Verified rename"
                : "AI suggestion - target exists"}
            </p>
            <div className="repair-change">
              <section>
                <h3>Current</h3>
                <pre className="repair-reference current-reference">{item.currentReference}</pre>
              </section>
              <section>
                <h3>After</h3>
                <pre className="repair-reference after-reference">{item.replacementReference}</pre>
              </section>
            </div>
          </article>
        ))}
      </div>
      <section className="expected-result" aria-label="Expected result">
        <h3>Expected result</h3>
        <ul>
          <li>{formatCount(prepared.batch.outcome.expectedFindingsResolved, "issue")} resolved</li>
          <li>{formatCount(prepared.batch.outcome.notesEdited, "note")} edited</li>
          <li>
            {formatCount(prepared.batch.outcome.findingsLeftUnchanged, "issue")} left unchanged
          </li>
        </ul>
      </section>
      <button
        className="steward-primary"
        type="button"
        disabled={applying}
        onClick={() => void onApply()}
      >
        Apply {count} {count === 1 ? "fix" : "fixes"}
      </button>
      <p className="approval-note">Nothing changes until you select Apply.</p>
    </section>
  );
}

function ResultView({
  result,
  onNext
}: {
  result: BatchApplyResult | null;
  onNext: () => Promise<void>;
}) {
  if (!result)
    return (
      <section className="steward-result" aria-label="Check result">
        <p className="steward-eyebrow">Check complete</p>
        <h2>Your vault looks clear</h2>
        <p>No issues need your attention right now.</p>
        <button className="steward-primary" type="button" onClick={() => void onNext()}>
          Check again
        </button>
      </section>
    );

  return (
    <section className="steward-result" aria-label="Apply result">
      <p className="steward-eyebrow">Finished</p>
      <h2>Your vault is updated</h2>
      <ul>
        <li>{formatCount(result.appliedProposalIds.length, "fix")} applied</li>
        <li>{formatCount(result.notesEdited, "note")} changed</li>
        <li>{result.reindexed ? "Vault checked again" : "Vault check needs to be retried"}</li>
      </ul>
      <button className="steward-primary" type="button" onClick={() => void onNext()}>
        Review next issue
      </button>
    </section>
  );
}

function JudgmentView({
  finding,
  openNote,
  dismissing,
  onNotImportant
}: {
  finding: Finding;
  openNote?: (path: string) => void | Promise<void>;
  dismissing: boolean;
  onNotImportant: (finding: Finding) => Promise<void>;
}) {
  const paths = [
    ...new Set(
      finding.affectedNoteIds.length
        ? finding.affectedNoteIds
        : finding.evidence.map((item) => item.notePath)
    )
  ];
  const multiple = paths.length > 1;
  return (
    <section className="judgment-view" aria-label="Issue to review">
      <p className="steward-eyebrow">Needs your judgment</p>
      <h2>{finding.explanation}</h2>
      {paths[0] ? <p className="judgment-source">{paths.join(" and ")}</p> : null}
      <div className="judgment-actions">
        {paths[0] ? (
          <button
            className="steward-primary"
            type="button"
            onClick={() => {
              for (const path of paths) void openNote?.(path);
            }}
          >
            {multiple ? "Review both notes" : "Open note"}
          </button>
        ) : null}
        <button type="button" disabled={dismissing} onClick={() => void onNotImportant(finding)}>
          Not important
        </button>
      </div>
    </section>
  );
}

function IssueList({ findings }: { findings: readonly Finding[] }) {
  const [open, setOpen] = useState(false);
  if (findings.length === 0) return null;
  return (
    <section className="issue-list" aria-label="All issues">
      <button
        className="issue-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="vault-steward-all-issues"
        onClick={() => setOpen(!open)}
      >
        View all issues ({findings.length})
      </button>
      {open ? (
        <ul id="vault-steward-all-issues">
          {findings.map((finding) => (
            <li key={finding.id}>
              <strong>{finding.severity}</strong>
              <span>{finding.explanation}</span>
              <small>{finding.evidence[0]?.notePath ?? "Vault-wide"}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function scanFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("model output"))
    return "Model output could not be validated. Try again or review provider settings.";
  if (message.includes("model provider"))
    return "Model analysis did not complete. Check the configured provider and model.";
  if (message.includes("Vault reader") || message.includes("vault read"))
    return "The active vault could not be read.";
  if (message.includes("database")) return "The local Vault Steward database is unavailable.";
  if (message.includes("active policy"))
    return "The active policy is invalid. Open Advanced to review it.";
  return "The vault check could not complete. Try again.";
}

function batchFailureMessage(reason: BatchApplyResult["reason"]): string {
  switch (reason) {
    case "stale":
      return "A note changed after this preview. Check the vault again.";
    case "recovery-required":
      return "A write could not be rolled back. Open Advanced for recovery guidance.";
    case "write-failed":
      return "The approved fixes could not be written. Your previous note content was restored.";
    case "invalid":
      return "The prepared fixes are no longer valid. Check the vault again.";
    case "canceled":
      return "Applying fixes was canceled. Check the vault again.";
    default:
      return "The approved fixes could not be applied. Check the vault again.";
  }
}
