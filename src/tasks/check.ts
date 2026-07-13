export type TaskIssue = {
  id: string;
  kind: "malformed" | "orphaned" | "duplicated" | "overdue" | "abandoned";
  line: number;
};

export function checkTasks(content: string, today: string): TaskIssue[] {
  const seen = new Set<string>();
  const issues: TaskIssue[] = [];
  for (const [index, line] of content.split("\n").entries()) {
    if (!line.includes("- [")) continue;
    const match = /^\s*- \[([ xX])\]\s+(.+?)(?:\s+\^([\w-]+))?$/.exec(line);
    if (!match) {
      issues.push({ id: `line-${index + 1}`, kind: "malformed", line: index + 1 });
      continue;
    }
    const id = match[3] ?? `line-${index + 1}`;
    if (seen.has(id)) issues.push({ id, kind: "duplicated", line: index + 1 });
    seen.add(id);
    const due = /due:(\d{4}-\d{2}-\d{2})/.exec(match[2] ?? "")?.[1];
    if (due && due < today && match[1] === " ")
      issues.push({ id, kind: "overdue", line: index + 1 });
    if (!/project:\S+/.test(match[2] ?? "") || !/owner:\S+/.test(match[2] ?? ""))
      issues.push({ id, kind: "orphaned", line: index + 1 });
    if (/abandoned:true/.test(match[2] ?? ""))
      issues.push({ id, kind: "abandoned", line: index + 1 });
  }
  return issues;
}
