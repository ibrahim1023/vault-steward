import { createHash } from "node:crypto";

import type { ScanSnapshot, ScannedNote } from "../scanner/scan.js";
import { parseTask } from "../tasks/check.js";
import type { RepairCandidate } from "./task-decision-propose.js";

export type TaskDecisionCandidates = {
  owners: RepairCandidate[];
  projects: RepairCandidate[];
  dueDates: RepairCandidate[];
  decisions: RepairCandidate[];
};

export function buildDecisionRepairCandidates(
  snapshot: ScanSnapshot,
  decisionPath: string
): Pick<TaskDecisionCandidates, "projects" | "decisions"> {
  return {
    projects: uniqueCandidates(
      snapshot.notes
        .filter((note) => note.frontmatter.kind === "project")
        .map((note) => note.path)
        .sort(),
      "project"
    ),
    decisions: uniqueCandidates(
      snapshot.notes
        .filter((note) => note.frontmatter.kind === "decision" && note.path !== decisionPath)
        .map((note) => note.path)
        .sort(),
      "decision"
    )
  };
}

export function buildTaskDecisionCandidates(
  snapshot: ScanSnapshot,
  taskPath: string,
  taskId: string
): TaskDecisionCandidates {
  const taskNote = snapshot.notes.find((note) => note.path === taskPath);
  const task = taskNote ? findTask(taskNote, taskId) : null;
  if (!taskNote || !task) return emptyCandidates();

  const projects = snapshot.notes.filter((note) => note.frontmatter.kind === "project");
  const project = task.project ? resolveProject(projects, task.project) : undefined;
  const decisions = directDecisionNotes(snapshot, taskNote);
  return {
    owners: uniqueCandidates(
      projects.flatMap((note) => stringValues(note.frontmatter.owner)).sort(),
      "owner"
    ),
    projects: uniqueCandidates(projects.map((note) => note.path).sort(), "project"),
    dueDates: uniqueCandidates(
      [taskNote, ...(project ? [project] : []), ...decisions]
        .flatMap((note) => datesFrom(note))
        .filter((value) => value !== task.due)
        .sort(),
      "due"
    ),
    decisions: uniqueCandidates(decisions.map((note) => note.path).sort(), "decision")
  };
}

function findTask(note: ScannedNote, taskId: string) {
  return (
    note.content
      .split("\n")
      .map((line, index) => parseTask(line, index + 1))
      .find((task) => task?.id === taskId) ?? null
  );
}

function resolveProject(notes: readonly ScannedNote[], project: string): ScannedNote | undefined {
  const normalized = project.endsWith(".md") ? project : `${project}.md`;
  return notes.find((note) => note.path === normalized);
}

function directDecisionNotes(snapshot: ScanSnapshot, note: ScannedNote): ScannedNote[] {
  const targets = new Set(
    note.references.map((reference) => reference.rawTarget.split("#", 1)[0]?.trim() ?? "")
  );
  return snapshot.notes.filter((candidate) => {
    if (candidate.frontmatter.kind !== "decision") return false;
    const withoutExtension = candidate.path.replace(/\.md$/i, "");
    return targets.has(candidate.path) || targets.has(withoutExtension);
  });
}

function datesFrom(note: ScannedNote): string[] {
  const frontmatterDue = dueValues(note.frontmatter.due).filter(isValidDueDate);
  const taskDue = note.content
    .split("\n")
    .map((line, index) => parseTask(line, index + 1)?.due)
    .filter((value): value is string => Boolean(value && isValidDueDate(value)));
  return [...frontmatterDue, ...taskDue];
}

function uniqueCandidates(values: readonly string[], prefix: string): RepairCandidate[] {
  return [...new Set(values)].map((value) => ({ id: `${prefix}-${shortHash(value)}`, value }));
}

function stringValues(value: unknown): string[] {
  return typeof value === "string" ? [value] : [];
}

function dueValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return [value.toISOString().slice(0, 10)];
  return [];
}

function isValidDueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function emptyCandidates(): TaskDecisionCandidates {
  return { owners: [], projects: [], dueDates: [], decisions: [] };
}
