export type ComparableFindingOccurrence = {
  stableKey: string;
  occurrenceId: string;
  evidenceRevisionKey: string;
};

export type FindingTransitionKind = "unchanged" | "changed" | "resolved" | "recurring" | "new";

export type FindingTransition = {
  kind: FindingTransitionKind;
  stableKey: string;
  previousOccurrenceIds: readonly string[];
  currentOccurrenceIds: readonly string[];
};

export function compareFindingOccurrences(input: {
  previous: readonly ComparableFindingOccurrence[];
  current: readonly ComparableFindingOccurrence[];
  historical: readonly (readonly ComparableFindingOccurrence[])[];
}): FindingTransition[] {
  for (const list of [input.previous, input.current, ...input.historical]) {
    assertUniqueOccurrences(list);
  }
  const previous = groupByStableKey(input.previous);
  const current = groupByStableKey(input.current);
  const historicalKeys = new Set(
    input.historical.flatMap((list) => list.map((entry) => entry.stableKey))
  );
  const transitions: FindingTransition[] = [];
  for (const stableKey of new Set([...previous.keys(), ...current.keys()])) {
    const prior = previous.get(stableKey) ?? [];
    const now = current.get(stableKey) ?? [];
    const kind: FindingTransitionKind =
      prior.length > 0 && now.length > 0
        ? sameRevisionSet(prior, now)
          ? "unchanged"
          : "changed"
        : prior.length > 0
          ? "resolved"
          : historicalKeys.has(stableKey)
            ? "recurring"
            : "new";
    transitions.push({
      kind,
      stableKey,
      previousOccurrenceIds: prior.map((entry) => entry.occurrenceId).sort(),
      currentOccurrenceIds: now.map((entry) => entry.occurrenceId).sort()
    });
  }
  return transitions.sort((left, right) => left.stableKey.localeCompare(right.stableKey));
}

function assertUniqueOccurrences(list: readonly ComparableFindingOccurrence[]): void {
  const occurrenceIds = new Set<string>();
  const revisions = new Set<string>();
  for (const entry of list) {
    if (occurrenceIds.has(entry.occurrenceId)) {
      throw new Error("duplicate finding occurrence id");
    }
    occurrenceIds.add(entry.occurrenceId);
    const revisionKey = `${entry.stableKey} ${entry.evidenceRevisionKey}`;
    if (revisions.has(revisionKey)) {
      throw new Error("contradictory duplicate finding occurrence");
    }
    revisions.add(revisionKey);
  }
}

function groupByStableKey(
  list: readonly ComparableFindingOccurrence[]
): Map<string, ComparableFindingOccurrence[]> {
  const groups = new Map<string, ComparableFindingOccurrence[]>();
  for (const entry of list) {
    groups.set(entry.stableKey, [...(groups.get(entry.stableKey) ?? []), entry]);
  }
  return groups;
}

function sameRevisionSet(
  left: readonly ComparableFindingOccurrence[],
  right: readonly ComparableFindingOccurrence[]
): boolean {
  const leftSet = new Set(left.map((entry) => entry.evidenceRevisionKey));
  const rightSet = new Set(right.map((entry) => entry.evidenceRevisionKey));
  return leftSet.size === rightSet.size && [...leftSet].every((key) => rightSet.has(key));
}
