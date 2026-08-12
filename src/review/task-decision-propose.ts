import type { Finding } from "../contracts/index.js";
import {
  parseDecisionRepairIntent,
  parseTaskRepairIntent,
  type DecisionRepairIntent,
  type TaskRepairIntent
} from "../contracts/task-decision-repair.js";
import type { Proposal } from "../contracts/proposal.js";
import { exactEvidenceStart } from "./evidence-range.js";
import { parseTask } from "../tasks/check.js";

export type RepairCandidate = { id: string; value: string };
export type RepairProposalSource = { path: string; revision: string; content: string };
export type TaskDecisionProposalResult =
  { applicable: true; proposal: Proposal } | { applicable: false; reason: string };

export function proposeTaskRepair(
  finding: Finding,
  source: RepairProposalSource,
  intentValue: TaskRepairIntent,
  candidates: readonly RepairCandidate[]
): TaskDecisionProposalResult {
  const parsedIntent = parseTaskRepairIntent(intentValue);
  const evidence = finding.evidence[0];
  if (
    !parsedIntent.ok ||
    finding.type !== "task" ||
    !evidence ||
    evidence.notePath !== source.path ||
    parsedIntent.value.scanId !== finding.scanId ||
    parsedIntent.value.findingId !== finding.id
  )
    return unavailable();

  const excerptStart = exactEvidenceStart(source.content, evidence.locator, evidence.excerpt);
  if (excerptStart === null) return unavailable();
  const task = parseTask(evidence.excerpt, lineNumber(evidence.locator));
  if (!task || task.id !== parsedIntent.value.taskId) return unavailable();
  const operation = taskOperation(
    evidence.excerpt,
    excerptStart,
    task,
    parsedIntent.value,
    candidates
  );
  if (!operation) return unavailable();
  return proposal(finding, source, operation.expected, operation.replacement, operation.start);
}

export function proposeDecisionRepair(
  finding: Finding,
  source: RepairProposalSource,
  intentValue: DecisionRepairIntent,
  candidates: readonly RepairCandidate[],
  activeEvidenceIds: readonly string[]
): TaskDecisionProposalResult {
  const parsedIntent = parseDecisionRepairIntent(intentValue);
  const evidence = finding.evidence[0];
  if (
    !parsedIntent.ok ||
    finding.type !== "decision" ||
    !evidence ||
    evidence.notePath !== source.path ||
    parsedIntent.value.scanId !== finding.scanId ||
    parsedIntent.value.findingId !== finding.id ||
    parsedIntent.value.decisionId !== source.path
  )
    return unavailable();

  const intent = parsedIntent.value;
  if (exactEvidenceStart(source.content, evidence.locator, evidence.excerpt) === null)
    return unavailable();
  let field: "project" | "relatedDecision" | "rationale";
  let value: string;
  if (intent.kind === "set-rationale") {
    if (!intent.rationale || !intent.evidenceIds?.every((id) => activeEvidenceIds.includes(id)))
      return unavailable();
    field = "rationale";
    value = intent.rationale;
  } else {
    const candidate = candidates.find((item) => item.id === intent.candidateId);
    if (!candidate || !isSafeVaultPath(candidate.value)) return unavailable();
    field = intent.kind === "link-project" ? "project" : "relatedDecision";
    value = candidate.value;
  }
  const operation = frontmatterOperation(source.content, field, value);
  if (!operation) return unavailable();
  return proposal(finding, source, operation.expected, operation.replacement, operation.start);
}

function taskOperation(
  excerpt: string,
  excerptStart: number,
  task: ReturnType<typeof parseTask> & {},
  intent: TaskRepairIntent,
  candidates: readonly RepairCandidate[]
): { start: number; expected: string; replacement: string } | null {
  const candidate = intent.candidateId
    ? candidates.find((item) => item.id === intent.candidateId)?.value
    : undefined;
  let expected: string;
  let replacement: string;
  switch (intent.kind) {
    case "mark-complete":
      if (!task.completionMarked || !/- \[ \]/.test(excerpt)) return null;
      expected = "- [ ]";
      replacement = "- [x]";
      break;
    case "replace-due-date":
      if (!task.due || !candidate || !isValidDueDate(candidate)) return null;
      expected = `due:${task.due}`;
      replacement = `due:${candidate}`;
      break;
    case "assign-owner":
      if (!candidate || !isSafeTaskValue(candidate)) return null;
      expected = task.owner ? `owner:${task.owner}` : "";
      replacement = `owner:${candidate}`;
      break;
    case "assign-project":
      if (!candidate || !isSafeTaskValue(candidate)) return null;
      expected = task.project ? `project:${task.project}` : "";
      replacement = `project:${candidate}`;
      break;
    case "clear-abandoned":
      if (!task.abandoned) return null;
      expected = "abandoned:true";
      replacement = "abandoned:false";
      break;
    case "resolve-duplicate-id":
      if (!candidate || !isSafeTaskId(candidate) || !excerpt.includes(`^${task.id}`)) return null;
      expected = `^${task.id}`;
      replacement = `^${candidate}`;
      break;
  }
  if (!expected) {
    const suffix = excerpt.match(/\s+\^[\w-]+\s*$/)?.[0] ?? "";
    const insertion = excerptStart + excerpt.length - suffix.length;
    return { start: insertion, expected: " ", replacement: ` ${replacement} ` };
  }
  const offset = excerpt.indexOf(expected);
  return offset < 0 ? null : { start: excerptStart + offset, expected, replacement };
}

function frontmatterOperation(
  content: string,
  field: "project" | "relatedDecision" | "rationale",
  value: string
): { start: number; expected: string; replacement: string } | null {
  const opening = /^---\r?\n/.exec(content);
  if (!opening) return null;
  const afterOpening = content.slice(opening[0].length);
  const closing = /(?:^|\r?\n)---(?:\r?\n|$)/.exec(afterOpening);
  if (!closing) return null;
  const header = afterOpening.slice(0, closing.index);
  const linePattern = new RegExp(`^${field}:[^\r\n]*`, "m");
  const match = linePattern.exec(header);
  const rendered = `${field}: ${JSON.stringify(value)}`;
  if (match) {
    return { start: opening[0].length + match.index, expected: match[0], replacement: rendered };
  }
  const newline = opening[0].endsWith("\r\n") ? "\r\n" : "\n";
  return { start: 0, expected: opening[0], replacement: `${opening[0]}${rendered}${newline}` };
}

function proposal(
  finding: Finding,
  source: RepairProposalSource,
  expected: string,
  replacement: string,
  start: number
): TaskDecisionProposalResult {
  return {
    applicable: true,
    proposal: {
      schemaVersion: 1,
      id: `proposal:${finding.id}`,
      findingId: finding.id,
      scanId: finding.scanId,
      explanation: "Apply the selected bounded task or decision repair.",
      operations: [
        {
          kind: "replace-range",
          path: source.path,
          sourceRevision: source.revision,
          start,
          end: start + expected.length,
          expected,
          replacement
        }
      ]
    }
  };
}

function lineNumber(locator: string): number {
  const value = /^line:(\d+)(?::column:\d+)?$/.exec(locator)?.[1];
  return value ? Number(value) : 1;
}

function isValidDueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isSafeTaskValue(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/.test(value);
}

function isSafeTaskId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/.test(value);
}

function isSafeVaultPath(value: string): boolean {
  return (
    value.endsWith(".md") &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").some((part) => !part || part === "." || part === "..")
  );
}

function unavailable(): TaskDecisionProposalResult {
  return { applicable: false, reason: "No deterministic task or decision repair is available." };
}
