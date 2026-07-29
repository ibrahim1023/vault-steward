import type { FindingLifecycleRecord } from "../storage/repositories.js";

export type KnowledgeHealthTrend = {
  retainedFindings: number;
  activeFindings: number;
  resolvedFindings: number;
  recurringFindings: number;
  staleFindings: number;
  byType: Array<{ type: string; active: number; resolved: number; recurring: number }>;
};

/** Uses retained lifecycle aggregates only; it never reads note content or changes findings. */
export function summarizeKnowledgeHealth(
  records: readonly FindingLifecycleRecord[]
): KnowledgeHealthTrend {
  const byType = new Map<string, { active: number; resolved: number; recurring: number }>();
  let activeFindings = 0;
  let resolvedFindings = 0;
  let recurringFindings = 0;
  let staleFindings = 0;
  for (const record of records) {
    const row = byType.get(record.type) ?? { active: 0, resolved: 0, recurring: 0 };
    if (record.resolved) {
      resolvedFindings++;
      row.resolved++;
    } else {
      activeFindings++;
      row.active++;
    }
    if (record.occurrences > 1) {
      recurringFindings++;
      row.recurring++;
    }
    if (record.stale) staleFindings++;
    byType.set(record.type, row);
  }
  return {
    retainedFindings: records.length,
    activeFindings,
    resolvedFindings,
    recurringFindings,
    staleFindings,
    byType: [...byType.entries()]
      .map(([type, counts]) => ({ type, ...counts }))
      .sort((left, right) => left.type.localeCompare(right.type))
  };
}
