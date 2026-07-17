import {
  REPLAY_VARIABLES,
  type FixtureReplayRecord,
  type RedactedReplayFindingResult,
  type RedactedReplayCaseResult,
  type ReplayComparison,
  type ReplayDurationChange,
  type ReplayFailureChange,
  type ReplayFindingDiff,
  type ReplayMetricDiff,
  type ReplayValueTransition,
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
  const findingDiff = emptyFindingDiff();
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
    collectFindingDiffs(baselineCase.findings, candidateCase.findings, id, findingDiff);
    return outcomeChange;
  });

  for (const [, caseResult] of candidateCases.entries()) {
    if (!baselineCases.has(caseResult.id)) {
      if (caseResult.errorCode) addedFailures.add(caseResult.errorCode);
      for (const finding of caseResult.findings) {
        findingDiff.added.push({ caseId: caseResult.id, findingKey: finding.findingKey });
      }
    }
  }

  for (const [, caseResult] of baselineCases.entries()) {
    if (!candidateCases.has(caseResult.id)) {
      if (caseResult.errorCode) removedFailures.add(caseResult.errorCode);
      for (const finding of caseResult.findings) {
        findingDiff.removed.push({ caseId: caseResult.id, findingKey: finding.findingKey });
      }
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
    findingDiff: sortFindingDiff(findingDiff),
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
  if (baseline !== null && candidate === null) target.removedFailures.add(baseline);
  target.failureChanges.push({ id, baseline, candidate });
}

function collectFindingDiffs(
  baseline: readonly RedactedReplayFindingResult[],
  candidate: readonly RedactedReplayFindingResult[],
  caseId: string,
  target: ReplayFindingDiff
): void {
  const baselineFindings = new Map(baseline.map((item) => [item.findingKey, item]));
  const candidateFindings = new Map(candidate.map((item) => [item.findingKey, item]));
  const allKeys = new Set([...baselineFindings.keys(), ...candidateFindings.keys()]);
  for (const findingKey of [...allKeys].sort()) {
    const baselineFinding = baselineFindings.get(findingKey);
    const candidateFinding = candidateFindings.get(findingKey);
    if (!baselineFinding && candidateFinding) {
      target.added.push({ caseId, findingKey });
      continue;
    }
    if (baselineFinding && !candidateFinding) {
      target.removed.push({ caseId, findingKey });
      continue;
    }
    if (!baselineFinding || !candidateFinding) continue;
    if (
      baselineFinding.evidence.notePath !== candidateFinding.evidence.notePath ||
      baselineFinding.evidence.locator !== candidateFinding.evidence.locator
    ) {
      target.evidenceChanges.push({
        caseId,
        findingKey,
        baseline: baselineFinding.evidence,
        candidate: candidateFinding.evidence
      });
    }
    if (baselineFinding.severity !== candidateFinding.severity) {
      target.severityChanges.push({
        caseId,
        findingKey,
        baseline: baselineFinding.severity,
        candidate: candidateFinding.severity
      });
    }
    if (
      baselineFinding.validation.supported !== candidateFinding.validation.supported ||
      baselineFinding.validation.schemaValid !== candidateFinding.validation.schemaValid ||
      baselineFinding.validation.routeValid !== candidateFinding.validation.routeValid ||
      baselineFinding.validation.terminated !== candidateFinding.validation.terminated
    ) {
      target.validationChanges.push({
        caseId,
        findingKey,
        baseline: baselineFinding.validation,
        candidate: candidateFinding.validation
      });
    }
  }
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
    if (delta !== null) diff[key] = delta;
  }
  return diff;
}

function diffNullableNumber(
  baseline: number | null,
  candidate: number | null
): ReplayValueTransition | null {
  if (baseline === candidate) return null;
  return {
    baseline,
    candidate,
    delta: baseline === null || candidate === null ? null : candidate - baseline
  };
}

function emptyFindingDiff(): ReplayFindingDiff {
  return {
    added: [],
    removed: [],
    evidenceChanges: [],
    severityChanges: [],
    validationChanges: []
  };
}

function sortFindingDiff(target: ReplayFindingDiff): ReplayFindingDiff {
  const byFinding = <T extends { caseId: string; findingKey: string }>(items: readonly T[]) =>
    [...items].sort(
      (left, right) =>
        left.caseId.localeCompare(right.caseId) || left.findingKey.localeCompare(right.findingKey)
    );
  return {
    added: byFinding(target.added),
    removed: byFinding(target.removed),
    evidenceChanges: byFinding(target.evidenceChanges),
    severityChanges: byFinding(target.severityChanges),
    validationChanges: byFinding(target.validationChanges)
  };
}
