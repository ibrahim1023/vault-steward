import { useEffect, useState } from "react";

import type { Finding } from "../contracts/index.js";
import type { PreparedRepairBatch } from "../contracts/prepared-repair.js";
import type { PreparedRepair, PreparedRepairItem } from "../review/prepare-repair-batch.js";
import type { DuplicateEntityReview as DuplicateEntityReviewData } from "../review/entity-duplicate-review.js";
import {
  buildEntityCanonicalCandidates,
  type EntityCanonicalRecommendation
} from "../review/entity-canonical-recommendation.js";
import type { BatchApplyResult } from "../review/workflow.js";
import type {
  FindingLifecycleRecord,
  ObservabilitySnapshot,
  ScanHistoryRecord
} from "../storage/repositories.js";
import { HistoryView } from "./HistoryView.js";
import { DuplicateEntityReview } from "./DuplicateEntityReview.js";
import { MaintenanceScheduleView } from "./MaintenanceScheduleView.js";
import { MaintenanceView } from "./MaintenanceView.js";
import { ModelReadinessView } from "./ModelReadinessView.js";
import { MoreTools } from "./MoreTools.js";
import { ObservabilityView } from "./ObservabilityView.js";
import { PromptRegistryView } from "./PromptRegistryView.js";
import { AIDebugConsole, QualityDiagnostics } from "./QualityDiagnostics.js";
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
  loadDuplicateEntityReview,
  recommendCanonicalEntity,
  prepareEntityConsolidation,
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
  prepareRepairs?: () => Promise<PreparedRepair | null>;
  applyRepairs?: (batch: PreparedRepairBatch) => Promise<BatchApplyResult>;
  openNote?: (path: string) => void | Promise<void>;
  markNotImportant?: (finding: Finding) => Promise<void>;
  loadDuplicateEntityReview?: (finding: Finding) => DuplicateEntityReviewData | null;
  recommendCanonicalEntity?: (finding: Finding) => Promise<EntityCanonicalRecommendation>;
  prepareEntityConsolidation?: (
    finding: Finding,
    candidateId: string
  ) => Promise<PreparedRepair | null>;
  openProviderSettings?: () => void;
  loadHistory?: () => { scans: ScanHistoryRecord[]; lifecycle: FindingLifecycleRecord[] };
  policyStudio?: {
    loadDraft: () => Promise<string>;
    previewDraft: (source: string) => Promise<import("../policy/studio.js").PolicyPreview>;
    saveDraft: (source: string) => Promise<void>;
    draftRuleFromFinding?: (
      findingId: string,
      source: string
    ) => Promise<import("../policy/studio.js").PolicyRuleDraft>;
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
  const [prepared, setPrepared] = useState<PreparedRepair | null>(null);
  const [actualResult, setActualResult] = useState<BatchApplyResult | null>(null);
  const [reviewingNext, setReviewingNext] = useState(false);
  const [judgment, setJudgment] = useState<Finding>();
  const [dismissedFindingIds, setDismissedFindingIds] = useState<Set<string>>(() => new Set());
  const [dismissing, setDismissing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [scanLimitations, setScanLimitations] = useState<string[]>([]);
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
    let nextPrepared: PreparedRepair | null = null;
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
    setScanLimitations([]);
    try {
      const result = await scan();
      const nextFindings = loadFindings ? await loadFindings() : result.findings;
      setFindings(nextFindings);
      setScanLimitations(result.limitations ?? []);
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
    setReviewingNext(true);
    setErrorMessage(undefined);
    try {
      const loadedFindings = loadFindings ? await loadFindings() : findings;
      // A completed repair must never be selected again, even while a delayed
      // re-index still exposes its former finding in the stored scan result.
      const nextFindings = loadedFindings.filter(
        (finding) => !prepared?.batch.findingIds.includes(finding.id)
      );
      setFindings(nextFindings);
      await chooseNext(nextFindings);
    } catch {
      setMode("error");
      setErrorMessage("The next issue could not be prepared. Check the vault again.");
    } finally {
      setReviewingNext(false);
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

  const prepareCanonicalConsolidation = async (finding: Finding, candidateId: string) => {
    if (!prepareEntityConsolidation) return false;
    try {
      const nextPrepared = await prepareEntityConsolidation(finding, candidateId);
      if (!nextPrepared) return false;
      setPrepared(nextPrepared);
      setJudgment(undefined);
      setMode("recommendation");
      return true;
    } catch {
      return false;
    }
  };

  const prepareMaintenanceRepair = async (): Promise<boolean> => {
    if (!prepareRepairs) return false;
    try {
      const nextPrepared = await prepareRepairs();
      if (!nextPrepared) return false;
      setPrepared(nextPrepared);
      setJudgment(undefined);
      setMode("recommendation");
      return true;
    } catch {
      return false;
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

      {scanLimitations.includes("local-model-output-unavailable") ? (
        <p className="steward-notice" role="status">
          AI review was incomplete. Core vault checks completed; run another check to retry AI
          analysis.
        </p>
      ) : null}

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
          <button className="steward-primary steward-scan-button" type="button" disabled>
            <span>Checking vault...</span>
            <span className="scan-progress-track" aria-hidden="true">
              <span className="scan-progress-indicator" />
            </span>
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
        <ResultView
          result={actualResult}
          reviewingNext={reviewingNext}
          onNext={actualResult ? reviewNext : checkVault}
        />
      ) : null}

      {mode === "judgment" && judgment ? (
        <JudgmentView
          finding={judgment}
          {...(openNote ? { openNote } : {})}
          dismissing={dismissing}
          onNotImportant={dismissJudgment}
          {...(loadDuplicateEntityReview
            ? { duplicateReview: loadDuplicateEntityReview(judgment) }
            : {})}
          {...(recommendCanonicalEntity
            ? { recommendCanonicalEntity: () => recommendCanonicalEntity(judgment) }
            : {})}
          {...(prepareEntityConsolidation
            ? {
                prepareConsolidation: (candidateId: string) =>
                  prepareCanonicalConsolidation(judgment, candidateId)
              }
            : {})}
        />
      ) : null}

      {mode === "error" && errorMessage ? (
        <section className="steward-error" aria-label="Action needed">
          <p role="alert">{errorMessage}</p>
          {openProviderSettings && errorMessage.includes("Open Settings") ? (
            <button type="button" onClick={openProviderSettings}>
              Open Settings
            </button>
          ) : null}
          <button className="steward-primary" type="button" onClick={checkVault}>
            Check vault again
          </button>
        </section>
      ) : null}

      <IssueList findings={activeFindings} />

      {openProviderSettings || history ? (
        <section className="workspace-utilities" aria-label="Workspace tools">
          {openProviderSettings ? (
            <button type="button" onClick={openProviderSettings}>
              Settings
            </button>
          ) : null}
          {history ? (
            <details className="history-disclosure">
              <summary>History</summary>
              <div className="history-content">
                <HistoryView scans={history.scans} lifecycle={history.lifecycle} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <MoreTools>
        {checkModelReadiness ? <ModelReadinessView checkReadiness={checkModelReadiness} /> : null}
        {policyStudio ? <PolicyStudio {...policyStudio} findings={findings} /> : null}
        {maintenance ? <MaintenanceScheduleView {...maintenance} /> : null}
        {inspectImpact ? (
          <MaintenanceView
            findings={findings}
            inspectImpact={inspectImpact}
            {...(openNote ? { openNote } : {})}
            {...(markNotImportant
              ? {
                  dismissFinding: (finding: Finding) => markNotImportant(finding)
                }
              : {})}
            {...(prepareRepairs ? { prepareSupportedRepair: prepareMaintenanceRepair } : {})}
          />
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
        <PromptRegistryView />
        {history && loadObservability ? (
          <QualityDiagnostics
            scans={history.scans}
            lifecycle={history.lifecycle}
            snapshot={loadObservability(history.scans[0]?.id)}
          />
        ) : null}
        {history && loadObservability ? (
          <AIDebugConsole snapshot={loadObservability(history.scans[0]?.id)} />
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
  prepared: PreparedRepair;
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
          <details className="repair-item" key={item.proposalId}>
            <summary>
              <span className="repair-status">
                <strong>{repairStatusLabel(item)}</strong>
                <small>{repairKindLabel(item.repairKind)}</small>
              </span>
              <span className="repair-change" aria-label="Exact repair change">
                <span>
                  <small>Current</small>
                  <code className="current-reference">{item.currentReference}</code>
                </span>
                <span className="repair-arrow" aria-hidden="true">
                  →
                </span>
                <span>
                  <small>After</small>
                  <code className="after-reference">{item.replacementReference}</code>
                </span>
              </span>
            </summary>
            <dl className="repair-details">
              <div>
                <dt>Source</dt>
                <dd>{item.sourcePath}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{item.locator}</dd>
              </div>
              {item.targetPath ? (
                <div>
                  <dt>Target</dt>
                  <dd>{item.targetPath}</dd>
                </div>
              ) : null}
              {item.targetAnchor ? (
                <div>
                  <dt>{item.targetAnchor.kind === "block" ? "Block" : "Heading"}</dt>
                  <dd>{item.targetAnchor.value}</dd>
                </div>
              ) : null}
              {item.targetExists !== undefined ? (
                <div>
                  <dt>Target check</dt>
                  <dd>{item.targetExists ? "Existing target" : "Target unavailable"}</dd>
                </div>
              ) : null}
              <div>
                <dt>Affected notes</dt>
                <dd>{item.affectedNotes.join(", ")}</dd>
              </div>
            </dl>
          </details>
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
        aria-busy={applying}
        onClick={() => void onApply()}
      >
        {applying ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            Applying {count} {count === 1 ? "fix" : "fixes"}...
          </>
        ) : (
          <>
            Apply {count} {count === 1 ? "fix" : "fixes"}
          </>
        )}
      </button>
      <p className="approval-note">Nothing changes until you select Apply.</p>
    </section>
  );
}

function ResultView({
  result,
  reviewingNext,
  onNext
}: {
  result: BatchApplyResult | null;
  reviewingNext: boolean;
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
      <button
        className="steward-primary"
        type="button"
        disabled={reviewingNext}
        aria-busy={reviewingNext}
        onClick={() => void onNext()}
      >
        {reviewingNext ? "Preparing next issue..." : "Review next issue"}
      </button>
    </section>
  );
}

function JudgmentView({
  finding,
  openNote,
  dismissing,
  onNotImportant,
  duplicateReview,
  recommendCanonicalEntity,
  prepareConsolidation
}: {
  finding: Finding;
  openNote?: (path: string) => void | Promise<void>;
  dismissing: boolean;
  onNotImportant: (finding: Finding) => Promise<void>;
  duplicateReview?: DuplicateEntityReviewData | null;
  recommendCanonicalEntity?: () => Promise<EntityCanonicalRecommendation>;
  prepareConsolidation?: (candidateId: string) => Promise<boolean>;
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
      {duplicateReview ? <DuplicateEntityReview review={duplicateReview} /> : null}
      {duplicateReview && prepareConsolidation ? (
        <CanonicalEntityActions
          review={duplicateReview}
          {...(recommendCanonicalEntity ? { recommend: recommendCanonicalEntity } : {})}
          prepare={prepareConsolidation}
        />
      ) : null}
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

function CanonicalEntityActions({
  review,
  recommend,
  prepare
}: {
  review: DuplicateEntityReviewData;
  recommend?: () => Promise<EntityCanonicalRecommendation>;
  prepare: (candidateId: string) => Promise<boolean>;
}) {
  const candidates = buildEntityCanonicalCandidates(review);
  const [recommendation, setRecommendation] = useState<EntityCanonicalRecommendation>();
  const [preparing, setPreparing] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    if (!recommend)
      return () => {
        active = false;
      };
    void recommend()
      .then((result) => {
        if (active) setRecommendation(result);
      })
      .catch(() => {
        if (active)
          setMessage(
            "AI could not rank these notes. Choose the note you want to keep as canonical."
          );
      });
    return () => {
      active = false;
    };
  }, [recommend]);

  const suggestedId =
    recommendation?.status === "ai-suggested" ? recommendation.intent.candidateId : undefined;
  return (
    <section className="canonical-entity-actions" aria-label="Canonical note choice">
      <h3>Choose the canonical note</h3>
      {recommendation?.status === "ai-suggested" ? (
        <p className="canonical-suggestion">
          AI suggests{" "}
          <strong>{candidates.find((candidate) => candidate.id === suggestedId)?.title}</strong>.
          You decide what to prepare.
        </p>
      ) : null}
      {recommendation?.status === "abstained" ? (
        <p className="canonical-abstention">
          AI did not choose a canonical note. You can still choose either existing note.
        </p>
      ) : null}
      {message ? <p className="canonical-abstention">{message}</p> : null}
      <div className="canonical-choices">
        {candidates.map((candidate) => (
          <button
            className={candidate.id === suggestedId ? "steward-primary" : undefined}
            type="button"
            key={candidate.id}
            disabled={preparing !== undefined}
            onClick={() => {
              setPreparing(candidate.id);
              setMessage(undefined);
              void prepare(candidate.id).then((prepared) => {
                if (!prepared) {
                  setPreparing(undefined);
                  setMessage(
                    "A safe consolidation could not be prepared. The notes were not changed."
                  );
                }
              });
            }}
          >
            {preparing === candidate.id
              ? "Preparing exact changes..."
              : `Prepare consolidation with ${candidate.title}`}
          </button>
        ))}
      </div>
      <p className="canonical-safety">
        Preparing a plan never changes either note. You will review every edit before Apply.
      </p>
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

function repairStatusLabel(item: PreparedRepairItem): string {
  if (item.repairFamily === "task") return "Bounded task repair";
  if (item.repairFamily === "decision") return "Cited decision repair";
  if (item.repairFamily === "entity") return "Duplicate consolidation";
  switch (item.targetStatus) {
    case "verified-rename":
      return "Verified rename";
    case "verified-canonical":
      return "Verified canonical target";
    default:
      return "AI suggestion - target exists";
  }
}

function repairKindLabel(kind: PreparedRepairItem["repairKind"]): string {
  switch (kind) {
    case "mark-complete":
      return "Mark task complete";
    case "replace-due-date":
      return "Due date";
    case "assign-owner":
      return "Task owner";
    case "assign-project":
      return "Task project";
    case "clear-abandoned":
      return "Abandonment state";
    case "resolve-duplicate-id":
      return "Task ID";
    case "link-project":
      return "Decision project";
    case "link-related-decision":
      return "Related decision";
    case "set-rationale":
      return "Decision rationale";
    case "replace-heading-anchor":
      return "Heading anchor";
    case "replace-block-anchor":
      return "Block anchor";
    case "normalize-reference":
      return "Reference normalization";
    case "transfer-alias":
      return "Alias transfer";
    default:
      return "Reference target";
  }
}

function scanFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("HyperFusion access requires acknowledgement"))
    return "HyperFusion needs permission before selected vault evidence can be sent. Open Settings to continue.";
  if (message.includes("OpenAI access requires acknowledgement"))
    return "OpenAI needs permission before selected vault evidence can be sent. Open Settings to continue.";
  if (message.includes("HyperFusion provider configuration"))
    return "HyperFusion needs a model and API key. Open Settings to continue.";
  if (message.includes("OpenAI provider configuration"))
    return "OpenAI needs a model and API key. Open Settings to continue.";
  if (message.includes("model output"))
    return "Model output could not be validated. Try again or review provider settings.";
  if (message.includes("model provider"))
    return "Model analysis did not complete. Check the configured provider and model.";
  if (message.includes("Vault reader") || message.includes("vault read"))
    return "The active vault could not be read.";
  if (message.includes("database")) return "The local Vault Steward database is unavailable.";
  if (message.includes("active policy"))
    return "The active policy is invalid. Open Diagnostics to review it.";
  return "The vault check could not complete. Try again.";
}

function batchFailureMessage(reason: BatchApplyResult["reason"]): string {
  switch (reason) {
    case "stale":
      return "A note changed after this preview. Check the vault again.";
    case "recovery-required":
      return "A write could not be rolled back. Open Diagnostics for recovery guidance.";
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
