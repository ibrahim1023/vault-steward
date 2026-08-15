import type { RetrievalEvent, RetrievalExpectation, RetrievalQualityReport } from "./contracts.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function evaluateRetrievalQuality(
  events: readonly RetrievalEvent[],
  expectations: readonly RetrievalExpectation[]
): RetrievalQualityReport {
  if (events.length === 0 && expectations.length === 0) return notConfiguredReport();
  if (events.length === 0)
    throw new Error("Retrieval events are required for configured expectations.");
  validateEvents(events);
  validateExpectations(expectations);

  const eventsByQuery = new Map(events.map((event) => [event.queryId, event]));
  const expectationsByQuery = new Map(expectations.map((item) => [item.queryId, item]));
  for (const queryId of eventsByQuery.keys()) {
    if (!expectationsByQuery.has(queryId)) throw new Error("Retrieval event has no expectation.");
  }

  const matchedQueries = expectations.filter((item) => eventsByQuery.has(item.queryId));
  const candidates = events.flatMap((event) => event.candidates);
  const relevantCandidateCount = matchedQueries.reduce((total, expectation) => {
    const candidateIds = new Set(
      eventsByQuery.get(expectation.queryId)!.candidates.map((item) => item.evidenceId)
    );
    return total + expectation.relevantEvidenceIds.filter((id) => candidateIds.has(id)).length;
  }, 0);
  const scoredCandidates = candidates.map((candidate) => candidate.score);
  const measuredEvents = events.filter((event) => event.cache !== "not-applicable");
  return {
    schemaVersion: 1,
    status: "measured",
    coverage: expectations.length === 0 ? 1 : matchedQueries.length / expectations.length,
    relevanceRate: candidates.length === 0 ? 0 : relevantCandidateCount / candidates.length,
    cacheHitRate:
      measuredEvents.length === 0
        ? null
        : measuredEvents.filter((event) => event.cache === "hit").length / measuredEvents.length,
    score:
      scoredCandidates.length === 0
        ? null
        : {
            min: Math.min(...scoredCandidates),
            max: Math.max(...scoredCandidates),
            mean: average(scoredCandidates)
          },
    p50LatencyMs: percentile(
      events.map((event) => event.durationMs),
      0.5
    ),
    p95LatencyMs: percentile(
      events.map((event) => event.durationMs),
      0.95
    ),
    missingQueryCount: expectations.length - matchedQueries.length
  };
}

function notConfiguredReport(): RetrievalQualityReport {
  return {
    schemaVersion: 1,
    status: "not-configured",
    coverage: null,
    relevanceRate: null,
    cacheHitRate: null,
    score: null,
    p50LatencyMs: null,
    p95LatencyMs: null,
    missingQueryCount: 0
  };
}

function validateEvents(events: readonly RetrievalEvent[]): void {
  const seenQueries = new Set<string>();
  for (const event of events) {
    if (!IDENTIFIER.test(event.queryId) || seenQueries.has(event.queryId)) {
      throw new Error("Retrieval query identifiers must be unique bounded identifiers.");
    }
    seenQueries.add(event.queryId);
    if (!Number.isSafeInteger(event.requestedK) || event.requestedK < 1 || event.requestedK > 100) {
      throw new Error("Retrieval requestedK must be a bounded positive integer.");
    }
    if (event.candidates.length > event.requestedK) {
      throw new Error("Retrieval candidates exceed requestedK.");
    }
    if (!["hit", "miss", "not-applicable"].includes(event.cache)) {
      throw new Error("Retrieval cache state is invalid.");
    }
    if (!Number.isFinite(event.durationMs) || event.durationMs < 0) {
      throw new Error("Retrieval duration must be finite and non-negative.");
    }
    const seenEvidence = new Set<string>();
    for (const candidate of event.candidates) {
      if (!IDENTIFIER.test(candidate.evidenceId) || seenEvidence.has(candidate.evidenceId)) {
        throw new Error("Retrieval candidate evidence identifiers must be unique and bounded.");
      }
      seenEvidence.add(candidate.evidenceId);
      if (!Number.isFinite(candidate.score)) throw new Error("Retrieval scores must be finite.");
    }
  }
}

function validateExpectations(expectations: readonly RetrievalExpectation[]): void {
  const seenQueries = new Set<string>();
  for (const expectation of expectations) {
    if (!IDENTIFIER.test(expectation.queryId) || seenQueries.has(expectation.queryId)) {
      throw new Error("Retrieval expectation query identifiers must be unique and bounded.");
    }
    seenQueries.add(expectation.queryId);
    const relevant = new Set<string>();
    for (const evidenceId of expectation.relevantEvidenceIds) {
      if (!IDENTIFIER.test(evidenceId) || relevant.has(evidenceId)) {
        throw new Error("Relevant evidence identifiers must be unique and bounded.");
      }
      relevant.add(evidenceId);
    }
  }
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: readonly number[], value: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * value) - 1]!;
}
