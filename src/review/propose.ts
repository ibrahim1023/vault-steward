import type { Finding } from "../contracts/index.js";
import type { Proposal } from "../contracts/proposal.js";

export type ProposalSource = { path: string; revision: string; content: string };
export type ProposalResult =
  { applicable: true; proposal: Proposal } | { applicable: false; reason: string };

export function proposeFix(
  finding: Finding,
  source: ProposalSource,
  target: string
): ProposalResult {
  const evidence = finding.evidence[0];
  if (finding.type !== "broken-reference" || !evidence || evidence.notePath !== source.path)
    return { applicable: false, reason: "No deterministic fix is available for this finding." };
  if (!/^\[\[[^\]]+\]\]$/.test(evidence.excerpt) || !/^[^/\\][^\\]*$/.test(target))
    return { applicable: false, reason: "The reference replacement is unsafe or ambiguous." };
  const start = source.content.indexOf(evidence.excerpt);
  if (start < 0)
    return { applicable: false, reason: "The snapshot evidence is no longer present." };
  return {
    applicable: true,
    proposal: {
      schemaVersion: 1,
      id: `proposal:${finding.id}`,
      findingId: finding.id,
      scanId: finding.scanId,
      explanation: "Replace the broken internal reference with the selected vault target.",
      operations: [
        {
          kind: "replace-range",
          path: source.path,
          sourceRevision: source.revision,
          start,
          end: start + evidence.excerpt.length,
          expected: evidence.excerpt,
          replacement: `[[${target}]]`
        }
      ]
    }
  };
}
