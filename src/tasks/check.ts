export type TaskIssueKind =
  "malformed" | "orphaned" | "duplicated" | "overdue" | "abandoned" | "completion-pending";
export type TaskIssue = { id: string; kind: TaskIssueKind; line: number };
export type ParsedTask = {
  id: string;
  checkboxCompleted: boolean;
  completed: boolean;
  owner: string | null;
  project: string | null;
  due: string | null;
  abandoned: boolean;
  completionMarked: boolean;
  line: number;
};

const TASK_PATTERN = /^\s*- \[([ xX])\]\s+(.+?)(?:\s+\^([\w-]+))?\s*$/;
const TASK_CANDIDATE_PATTERN = /^\s*- \[(?!\[)/;
const METADATA_PATTERN = /\b(owner|project|due|abandoned|completed|status):([^\s]+)/g;

export function checkTasks(content: string, now: string): TaskIssue[] {
  const seen = new Set<string>();
  return content.split("\n").flatMap((line, index) => {
    if (!TASK_CANDIDATE_PATTERN.test(line)) return [];
    const parsed = parseTask(line, index + 1);
    if (!parsed) return [{ id: `line-${index + 1}`, kind: "malformed" as const, line: index + 1 }];
    const issues: TaskIssue[] = [];
    if (seen.has(parsed.id)) issues.push({ id: parsed.id, kind: "duplicated", line: parsed.line });
    seen.add(parsed.id);
    if (!parsed.checkboxCompleted && parsed.completionMarked)
      issues.push({ id: parsed.id, kind: "completion-pending", line: parsed.line });
    if (!parsed.owner || !parsed.project)
      issues.push({ id: parsed.id, kind: "orphaned", line: parsed.line });
    if (!parsed.completed && parsed.due && isPast(parsed.due, now))
      issues.push({ id: parsed.id, kind: "overdue", line: parsed.line });
    if (!parsed.completed && parsed.abandoned)
      issues.push({ id: parsed.id, kind: "abandoned", line: parsed.line });
    return issues;
  });
}

export function parseTask(line: string, lineNumber: number): ParsedTask | null {
  const match = TASK_PATTERN.exec(line);
  if (!match) return null;
  const body = match[2] ?? "";
  const metadata = Object.fromEntries(
    [...body.matchAll(METADATA_PATTERN)].map((item) => [item[1]!, item[2]!])
  ) as Record<string, string | undefined>;
  if (metadata.due && Number.isNaN(Date.parse(metadata.due))) return null;
  return {
    id: match[3] ?? `line-${lineNumber}`,
    checkboxCompleted: match[1] !== " ",
    completed:
      match[1] !== " " ||
      metadata.completed === "true" ||
      metadata.status?.toLowerCase() === "done",
    owner: metadata.owner ?? null,
    project: metadata.project ?? null,
    due: metadata.due ?? null,
    abandoned: metadata.abandoned === "true",
    completionMarked: metadata.completed === "true" || metadata.status?.toLowerCase() === "done",
    line: lineNumber
  };
}

function isPast(due: string, now: string): boolean {
  const normalizedDue = /^\d{4}-\d{2}-\d{2}$/.test(due) ? `${due}T23:59:59.999Z` : due;
  return Date.parse(normalizedDue) < Date.parse(now);
}
