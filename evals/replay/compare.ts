import {
  REPLAY_VARIABLES,
  type FixtureReplayRecord,
  type RedactedReplayCaseResult,
  type ReplayComparison,
  type ReplayDurationChange,
  type ReplayFailureChange,
  type ReplayMetricDiff,
  type ReplayVariable
} from "./contracts.js";

export function compareReplayRuns(
  baseline: FixtureReplayRecord,
  candidate: FixtureReplayRecord
): ReplayComparison {
  if (baseline.fixtureManifestHash !== candidate.fixtureManifestHash) {
    return { accepted: false, reason: "fixture-manifest-mismatch" };
  }

  const changed = REPLAY_VARIABLES.filter(
    (key) => baseline.configuration[key] !== candidate.configuration[key]
  );
  if (changed.length !== 1) {
    return {
      accepted: false,
      reason:
        changed.length === 0 ? "no-configuration-change" : "multiple-configuration-changes"
    };
  }

  const baselineCases = indexCaseResults(baseline.caseResults);
  const candidateCases = indexCaseResults(candidate.caseResults);
  const sharedCaseIds = [...baselineCases.keys()].filter((id) => candidateCases.has(id)).sort();
  const addedFailures = new Set<string>();
  const removedFailures = new Set<string>();
  const failureChanges: ReplayFailureChange[] = [];
  const durationChanges: ReplayDurationChange[] = [];
  const outcomeChanges = sharedCaseIds.flatMap((id) => {
    const baselineCase = baselineCases.get(id)!;
    const candidateCase = candidateCases.get(id)!;
    const outcomeChange =
      baselineCase.outcome === candidateCase.outcome
        ? []
        : [{ id, baseline: baselineCase.outcome, candidate: candidateCase.outcome }];
    const durationDelta = candidateCase.durationMs - baselineCase.durationMs;
    if (durationDelta !== 0) durationChanges.push({ id, deltaMs: durationDelta });
    collectFailureDiffs(baselineCase.errorCode, candidateCase.errorCode, id, {
      addedFailures,
      removedFailures,
      failureChanges
    });
    return outcomeChange;
  });

  for (const [, caseResult] of candidateCases.entries()) {
    if (!baselineCases.has(caseResult.id) && caseResult.errorCode) {
      addedFailures.add(caseResult.errorCode);
    }
  }

  return {
    accepted: true,
    changedVariable: changed[0] as ReplayVariable,
    caseDiff: {
      added: sortedDifference(candidateCases, baselineCases),
      removed: sortedDifference(baselineCases, candidateCases),
      outcomeChanges,
      durationChanges
    },
    failureDiff: {
      added: [...addedFailures].sort(),
      removed: [...removedFailures].sort(),
      changed: failureChanges.sort((left, right) => left.id.localeCompare(right.id))
    },
    metricDiff: diffMetrics(baseline.metrics, candidate.metrics),
    runtimeDiff: {
      totalDurationMs: candidate.runtime.totalDurationMs - baseline.runtime.totalDurationMs,
      peakMemoryBytes: candidate.runtime.peakMemoryBytes - baseline.runtime.peakMemoryBytes,
      inputTokens: diffNullableNumber(baseline.runtime.inputTokens, candidate.runtime.inputTokens),
      outputTokens: diffNullableNumber(
        baseline.runtime.outputTokens,
        candidate.runtime.outputTokens
      )
    }
  };
}

function indexCaseResults(
  caseResults: readonly RedactedReplayCaseResult[]
): Map<string, RedactedReplayCaseResult> {
  return new Map(caseResults.map((item) => [item.id, item]));
}

function sortedDifference(
  left: ReadonlyMap<string, RedactedReplayCaseResult>,
  right: ReadonlyMap<string, RedactedReplayCaseResult>
): string[] {
  return [...left.keys()].filter((id) => !right.has(id)).sort();
}

function collectFailureDiffs(
  baseline: string | null,
  candidate: string | null,
  id: string,
  target: {
    addedFailures: Set<string>;
    removedFailures: Set<string>;
    failureChanges: ReplayFailureChange[];
  }
): void {
  if (baseline === candidate) return;
  target.failureChanges.push({ id, baseline, candidate });
}

function diffMetrics(
  baseline: FixtureReplayRecord["metrics"],
  candidate: FixtureReplayRecord["metrics"]
): ReplayMetricDiff {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  const diff: ReplayMetricDiff = {};
  for (const key of keys) {
    const baselineValue = baseline[key];
    const candidateValue = candidate[key];
    const delta = diffNullableNumber(
      baselineValue === undefined ? null : baselineValue,
      candidateValue === undefined ? null : candidateValue
    );
    if (delta !== null && delta !== 0) diff[key] = delta;
  }
  return diff;
}

function diffNullableNumber(baseline: number | null, candidate: number | null): number | null {
  if (baseline === null || candidate === null) return baseline === candidate ? null : null;
  return candidate - baseline;
}
