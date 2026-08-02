import { createHash } from "node:crypto";

import {
  calculatePreparedRepairOutcome,
  type PreparedRepairBatch
} from "../contracts/prepared-repair.js";
import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";
import type { ScanSnapshot } from "../scanner/scan.js";
import { proposeReferenceRepair, type ProposalSource } from "./propose.js";
import {
  buildReferenceRepairCandidates,
  recommendReferenceRepair,
  type ReferenceCandidateSelectionRequest,
  type ReferenceRename
} from "./reference-recommendation.js";

const MAX_PREPARED_FIXES = 5;

export type PreparedRepairItem = {
  proposalId: string;
  findingId: string;
  sourcePath: string;
  locator: string;
  currentReference: string;
  replacementReference: string;
  repairFamily: "reference" | "task" | "decision" | "entity" | "schema";
  repairKind: string;
  targetPath?: string;
  targetExists?: true;
  targetAnchor?: { kind: "heading" | "block"; value: string };
  targetStatus?: "verified-rename" | "verified-canonical" | "ai-suggested";
  affectedNotes: string[];
};

export type PreparedRepair = {
  batch: PreparedRepairBatch;
  proposals: Proposal[];
  items: PreparedRepairItem[];
};

export type PreparedReferenceRepair = PreparedRepair;

export async function prepareReferenceRepairBatch(input: {
  snapshot: ScanSnapshot;
  findings: readonly Finding[];
  renames?: readonly ReferenceRename[];
  readSource: (path: string) => Promise<Omit<ProposalSource, "path">>;
  selectCandidate: (request: ReferenceCandidateSelectionRequest) => Promise<unknown>;
  persistProposal: (proposal: Proposal) => void | Promise<void>;
}): Promise<PreparedReferenceRepair | null> {
  const activeFindings = input.findings.filter((finding) => finding.status === "open");
  const proposals: Proposal[] = [];
  const items: PreparedRepairItem[] = [];

  for (const finding of activeFindings) {
    if (proposals.length >= MAX_PREPARED_FIXES) break;
    const evidence = finding.evidence[0];
    if (!["broken-reference", "reference-normalization"].includes(finding.type) || !evidence)
      continue;

    const candidates = buildReferenceRepairCandidates({
      finding,
      snapshot: input.snapshot,
      ...(input.renames ? { renames: input.renames } : {})
    });
    if (candidates.length === 0) continue;
    const recommendation = await recommendReferenceRepair({
      finding,
      scanId: input.snapshot.id,
      candidates,
      selectCandidate: input.selectCandidate
    });
    if (recommendation.status === "abstained") continue;

    let source: Omit<ProposalSource, "path">;
    try {
      source = await input.readSource(evidence.notePath);
    } catch {
      continue;
    }
    const result = proposeReferenceRepair(
      finding,
      { path: evidence.notePath, ...source },
      recommendation.intent
    );
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
      repairFamily: "reference",
      repairKind: recommendation.intent.kind,
      targetPath: recommendation.intent.targetPath,
      targetExists: true,
      ...(recommendation.intent.anchor
        ? {
            targetAnchor: {
              kind: recommendation.intent.anchor.kind,
              value: recommendation.intent.anchor.value
            }
          }
        : {}),
      targetStatus: recommendation.status,
      affectedNotes: [...finding.affectedNoteIds]
    });
  }

  if (proposals.length === 0) return null;
  const outcome = calculatePreparedRepairOutcome(proposals, activeFindings.length);
  const proposalIds = proposals.map((proposal) => proposal.id);
  return {
    batch: {
      schemaVersion: 1,
      id: `batch:${input.snapshot.id}:${shortHash(proposalIds)}`,
      scanId: input.snapshot.id,
      proposalIds,
      findingIds: proposals.map((proposal) => proposal.findingId),
      outcome
    },
    proposals,
    items
  };
}

export function combinePreparedRepairs(
  scanId: string,
  activeFindingCount: number,
  repairs: readonly (PreparedRepair | null)[]
): PreparedRepair | null {
  const available = repairs.filter((repair): repair is PreparedRepair => repair !== null);
  if (available.length === 0 || available.some((repair) => repair.batch.scanId !== scanId))
    return null;
  const proposals = available.flatMap((repair) => repair.proposals);
  const items = available.flatMap((repair) => repair.items);
  const proposalIds = proposals.map((proposal) => proposal.id);
  const findingIds = proposals.map((proposal) => proposal.findingId);
  if (
    proposals.length === 0 ||
    new Set(proposalIds).size !== proposalIds.length ||
    new Set(findingIds).size !== findingIds.length
  )
    return null;
  return {
    batch: {
      schemaVersion: 1,
      id: `batch:${scanId}:${shortHash(proposalIds)}`,
      scanId,
      proposalIds,
      findingIds,
      outcome: calculatePreparedRepairOutcome(proposals, activeFindingCount)
    },
    proposals,
    items
  };
}

function shortHash(values: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}
