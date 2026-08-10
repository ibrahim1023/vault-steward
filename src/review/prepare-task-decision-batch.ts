import { createHash } from "node:crypto";

import {
  calculatePreparedRepairOutcome,
  type PreparedRepairBatch
} from "../contracts/prepared-repair.js";
import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";
import type { ScanSnapshot } from "../scanner/scan.js";
import { parseTask } from "../tasks/check.js";
import {
  buildDecisionRepairCandidates,
  buildTaskDecisionCandidates
} from "./task-decision-candidates.js";
import {
  recommendTaskDecisionRepair,
  type TaskDecisionSelectionRequest
} from "./task-decision-recommendation.js";
import {
  proposeDecisionRepair,
  proposeTaskRepair,
  type RepairCandidate,
  type RepairProposalSource
} from "./task-decision-propose.js";
import type { PreparedRepair, PreparedRepairItem } from "./prepare-repair-batch.js";

const MAX_PREPARED_FIXES = 5;

export async function prepareTaskDecisionRepairBatch(input: {
  snapshot: ScanSnapshot;
  findings: readonly Finding[];
  readSource: (path: string) => Promise<Omit<RepairProposalSource, "path">>;
  selectIntent: (request: TaskDecisionSelectionRequest) => Promise<unknown>;
  persistProposal: (proposal: Proposal) => void | Promise<void>;
}): Promise<PreparedRepair | null> {
  const activeFindings = input.findings.filter((finding) => finding.status === "open");
  const proposals: Proposal[] = [];
  const items: PreparedRepairItem[] = [];

  for (const finding of activeFindings) {
    if (proposals.length >= MAX_PREPARED_FIXES) break;
    if (finding.type !== "task" && finding.type !== "decision") continue;
    const recommendation = await recommendTaskDecisionRepair({
      finding,
      snapshot: input.snapshot,
      selectIntent: input.selectIntent
    });
    if (recommendation.status === "abstained") continue;
    const evidence = finding.evidence[0];
    if (!evidence) continue;
    let source: Omit<RepairProposalSource, "path">;
    try {
      source = await input.readSource(evidence.notePath);
    } catch {
      continue;
    }

    const candidates = repairCandidates(input.snapshot, finding, recommendation.intent);
    const result =
      finding.type === "task" && "taskId" in recommendation.intent
        ? proposeTaskRepair(
            finding,
            { path: evidence.notePath, ...source },
            recommendation.intent,
            candidates
          )
        : finding.type === "decision" && "decisionId" in recommendation.intent
          ? proposeDecisionRepair(
              finding,
              { path: evidence.notePath, ...source },
              recommendation.intent,
              candidates,
              finding.evidence.map((_, index) => `evidence-${index + 1}`)
            )
          : unavailable();
    if (!result.applicable) continue;
    await input.persistProposal(result.proposal);
    const operation = result.proposal.operations[0]!;
    proposals.push(result.proposal);
    items.push({
      proposalId: result.proposal.id,
      findingId: finding.id,
      sourcePath: operation.path,
      locator: evidence.locator,
      currentReference: operation.expected,
      replacementReference: operation.replacement,
      repairFamily: finding.type,
      repairKind: recommendation.intent.kind,
      targetStatus: "ai-suggested",
      affectedNotes: [...finding.affectedNoteIds]
    });
  }

  if (proposals.length === 0) return null;
  const proposalIds = proposals.map((proposal) => proposal.id);
  const batch: PreparedRepairBatch = {
    schemaVersion: 1,
    id: `batch:${input.snapshot.id}:${shortHash(proposalIds)}`,
    scanId: input.snapshot.id,
    proposalIds,
    findingIds: proposals.map((proposal) => proposal.findingId),
    outcome: calculatePreparedRepairOutcome(proposals, activeFindings.length)
  };
  return { batch, proposals, items };
}

function unavailable() {
  return {
    applicable: false as const,
    reason: "No deterministic task or decision repair is available."
  };
}

function repairCandidates(
  snapshot: ScanSnapshot,
  finding: Finding,
  intent: { kind: string; taskId?: string; decisionId?: string }
): RepairCandidate[] {
  const decisionId = intent.decisionId;
  if (finding.type === "decision" && decisionId && decisionId === finding.evidence[0]?.notePath) {
    const candidates = buildDecisionRepairCandidates(snapshot, decisionId);
    if (intent.kind === "link-project") return candidates.projects;
    if (intent.kind === "link-related-decision") return candidates.decisions;
    return [];
  }
  if (finding.type !== "task") return [];
  const evidence = finding.evidence[0];
  if (!evidence) return [];
  const task = parseTask(evidence.excerpt, lineNumber(evidence.locator));
  if (!task || task.id !== intent.taskId) return [];
  const candidates = buildTaskDecisionCandidates(snapshot, evidence.notePath, task.id);
  switch (intent.kind) {
    case "replace-due-date":
      return candidates.dueDates;
    case "assign-owner":
      return candidates.owners;
    case "assign-project":
      return candidates.projects;
    case "resolve-duplicate-id":
      return nextDuplicateIdCandidate(snapshot, task.id);
    default:
      return [];
  }
}

function nextDuplicateIdCandidate(snapshot: ScanSnapshot, taskId: string): RepairCandidate[] {
  const usedIds = new Set(
    snapshot.notes.flatMap((note) =>
      note.content
        .split("\n")
        .map((line, index) => parseTask(line, index + 1)?.id)
        .filter((value): value is string => Boolean(value))
    )
  );
  for (let index = 2; index <= 100; index++) {
    const value = `${taskId}-${index}`;
    if (!usedIds.has(value)) return [{ id: `id-${value}`, value }];
  }
  return [];
}

function lineNumber(locator: string): number {
  const value = /^line:(\d+)(?::column:\d+)?$/.exec(locator)?.[1];
  return value ? Number(value) : 1;
}

function shortHash(values: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}
