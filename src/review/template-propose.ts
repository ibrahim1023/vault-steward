import { createHash } from "node:crypto";

import type { Finding } from "../contracts/index.js";
import {
  parseTemplateRepairIntent,
  type TemplateRepairIntent
} from "../contracts/template-repair.js";
import {
  classifyPolicyTemplateNote,
  getPolicyTemplate,
  validatePolicyTemplateNote
} from "../policy/templates.js";
import type { ScanSnapshot } from "../scanner/scan.js";
import type { Proposal } from "../contracts/proposal.js";

export type TemplateRepairCandidate = { id: string; value: string };

export function buildTemplateRepairCandidates(
  snapshot: ScanSnapshot,
  finding: Finding
): TemplateRepairCandidate[] {
  const sourcePath = finding.evidence[0]?.notePath;
  const field = finding.evidence[0]?.locator.replace("frontmatter:", "");
  const source = sourcePath ? snapshot.notes.find((note) => note.path === sourcePath) : undefined;
  const templateId = source ? classifyPolicyTemplateNote(source).templateId : null;
  if (
    !source ||
    finding.type !== "schema" ||
    !field ||
    !templateId ||
    !getPolicyTemplate(templateId)
  )
    return [];
  return [
    ...new Set(
      snapshot.notes
        .filter((note) => classifyPolicyTemplateNote(note).templateId === templateId)
        .map((note) => note.frontmatter[field])
        .filter((value): value is string => typeof value === "string" && isSafeValue(value))
    )
  ]
    .sort()
    .map((value) => ({ id: candidateId(templateId, field, value), value }));
}

export function proposeTemplateFrontmatterRepair(input: {
  finding: Finding;
  snapshot: ScanSnapshot;
  source: { path: string; revision: string; content: string };
  intent: TemplateRepairIntent;
}): { applicable: true; proposal: Proposal } | { applicable: false; reason: string } {
  const parsed = parseTemplateRepairIntent(input.intent);
  const evidence = input.finding.evidence[0];
  const note = evidence
    ? input.snapshot.notes.find((item) => item.path === evidence.notePath)
    : undefined;
  if (
    !parsed.ok ||
    !evidence ||
    !note ||
    input.finding.type !== "schema" ||
    input.source.path !== note.path ||
    parsed.value.scanId !== input.finding.scanId ||
    parsed.value.findingId !== input.finding.id
  )
    return unavailable();
  const classification = classifyPolicyTemplateNote(note);
  const template = classification.templateId
    ? getPolicyTemplate(classification.templateId)
    : undefined;
  const field = evidence.locator.replace("frontmatter:", "");
  if (
    !template ||
    classification.templateId !== parsed.value.templateId ||
    field !== parsed.value.field ||
    !validatePolicyTemplateNote(note, [template.id]).some(
      (issue) => issue.field === field && issue.message === input.finding.explanation
    )
  )
    return unavailable();
  const candidate = buildTemplateRepairCandidates(input.snapshot, input.finding).find(
    (item) => item.id === parsed.value.candidateId
  );
  if (!candidate) return unavailable();
  const operation = frontmatterOperation(input.source.content, field, candidate.value);
  if (!operation) return unavailable();
  return {
    applicable: true,
    proposal: {
      schemaVersion: 1,
      id: `proposal:${input.finding.id}`,
      findingId: input.finding.id,
      scanId: input.finding.scanId,
      explanation: "Apply the selected bounded template field repair.",
      operations: [
        {
          kind: "replace-range",
          path: input.source.path,
          sourceRevision: input.source.revision,
          ...operation
        }
      ]
    }
  };
}

function frontmatterOperation(content: string, field: string, value: string) {
  if (!/^---\n/.test(content)) return null;
  const closing = content.indexOf("\n---\n", 3);
  if (closing < 0) return null;
  const header = content.slice(4, closing);
  if (new RegExp(`^${escape(field)}:`, "m").test(header)) return null;
  return {
    start: 0,
    end: 4,
    expected: "---\n",
    replacement: `---\n${field}: ${JSON.stringify(value)}\n`
  };
}

function candidateId(templateId: string, field: string, value: string): string {
  return `candidate:${createHash("sha256").update(`${templateId}\0${field}\0${value}`).digest("hex").slice(0, 20)}`;
}
function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isSafeValue(value: string) {
  return value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/.test(value);
}
function unavailable() {
  return { applicable: false as const, reason: "No deterministic template repair is available." };
}
