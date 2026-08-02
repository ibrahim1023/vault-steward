import { createHash } from "node:crypto";

import {
  calculatePreparedRepairOutcome,
  type PreparedRepairBatch
} from "../contracts/prepared-repair.js";
import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";
import type { ScanSnapshot } from "../scanner/scan.js";
import type { PreparedRepair, PreparedRepairItem } from "./prepare-repair-batch.js";
import {
  buildTemplateRepairCandidates,
  proposeTemplateFrontmatterRepair
} from "./template-propose.js";

export async function prepareTemplateRepairBatch(input: {
  snapshot: ScanSnapshot;
  findings: readonly Finding[];
  readSource: (path: string) => Promise<{ revision: string; content: string }>;
  persistProposal: (proposal: Proposal) => void | Promise<void>;
}): Promise<PreparedRepair | null> {
  const active = input.findings.filter((finding) => finding.status === "open");
  const proposals: Proposal[] = [];
  const items: PreparedRepairItem[] = [];
  for (const finding of active) {
    if (proposals.length >= 5 || finding.type !== "schema") continue;
    const evidence = finding.evidence[0];
    if (!evidence) continue;
    const candidates = buildTemplateRepairCandidates(input.snapshot, finding);
    if (candidates.length !== 1) continue;
    let source: { revision: string; content: string };
    try {
      source = await input.readSource(evidence.notePath);
    } catch {
      continue;
    }
    const note = input.snapshot.notes.find((item) => item.path === evidence.notePath);
    if (!note) continue;
    const result = proposeTemplateFrontmatterRepair({
      finding,
      snapshot: input.snapshot,
      source: { path: evidence.notePath, ...source },
      intent: {
        schemaVersion: 1,
        kind: "set-frontmatter",
        scanId: input.snapshot.id,
        findingId: finding.id,
        templateId: String(note.frontmatter.kind),
        field: evidence.locator.replace("frontmatter:", ""),
        candidateId: candidates[0]!.id
      }
    });
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
      repairFamily: "schema",
      repairKind: "set-frontmatter",
      affectedNotes: [...finding.affectedNoteIds]
    });
  }
  if (!proposals.length) return null;
  const proposalIds = proposals.map((proposal) => proposal.id);
  const batch: PreparedRepairBatch = {
    schemaVersion: 1,
    id: `batch:${input.snapshot.id}:${shortHash(proposalIds)}`,
    scanId: input.snapshot.id,
    proposalIds,
    findingIds: proposals.map((proposal) => proposal.findingId),
    outcome: calculatePreparedRepairOutcome(proposals, active.length)
  };
  return { batch, proposals, items };
}
function shortHash(values: readonly string[]) {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}
