import { createHash } from "node:crypto";

import {
  calculatePreparedRepairOutcome,
  type PreparedRepairBatch
} from "../contracts/prepared-repair.js";
import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";
import type { ScanSnapshot } from "../scanner/scan.js";
import { proposeFix, type ProposalSource } from "./propose.js";
import {
  buildReferenceTargetCandidates,
  recommendReferenceRepair,
  type ReferenceCandidateSelectionRequest,
  type ReferenceRename
} from "./reference-recommendation.js";

const MAX_PREPARED_FIXES = 5;

export type PreparedReferenceRepairItem = {
  proposalId: string;
  findingId: string;
  sourcePath: string;
  locator: string;
  currentReference: string;
  replacementReference: string;
  targetPath: string;
  targetStatus: "verified-rename" | "ai-suggested";
};

export type PreparedReferenceRepair = {
  batch: PreparedRepairBatch;
  proposals: Proposal[];
  items: PreparedReferenceRepairItem[];
};

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
  const items: PreparedReferenceRepairItem[] = [];

  for (const finding of activeFindings) {
    if (proposals.length >= MAX_PREPARED_FIXES) break;
    const evidence = finding.evidence[0];
    if (finding.type !== "broken-reference" || !evidence) continue;

    const candidates = buildReferenceTargetCandidates({
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
    const result = proposeFix(
      finding,
      { path: evidence.notePath, ...source },
      stripExtension(recommendation.targetPath)
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
      targetPath: recommendation.targetPath,
      targetStatus: recommendation.status
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

function stripExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

function shortHash(values: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}
