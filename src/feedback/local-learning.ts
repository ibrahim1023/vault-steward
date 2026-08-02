import type { Finding } from "../contracts/index.js";
import type { ReviewerFeedbackRecord } from "../storage/repositories.js";

export type FeedbackPattern = {
  key: string;
  count: number;
};

export function findingFeedbackPattern(finding: Finding): string {
  const notes = [...new Set(finding.affectedNoteIds)].sort();
  return `${finding.type}:${notes.join("|")}`;
}

export function recurringSuppressionCandidates(
  records: readonly ReviewerFeedbackRecord[],
  minimumCount = 3
): FeedbackPattern[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.verdict !== "false-positive" || !record.patternKey) continue;
    counts.set(record.patternKey, (counts.get(record.patternKey) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count >= minimumCount)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function isLocallySuppressed(finding: Finding, patterns: readonly string[]): boolean {
  return patterns.includes(findingFeedbackPattern(finding));
}
