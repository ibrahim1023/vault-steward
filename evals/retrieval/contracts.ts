export type RetrievalCandidate = {
  evidenceId: string;
  score: number;
};

export type RetrievalEvent = {
  queryId: string;
  requestedK: number;
  candidates: RetrievalCandidate[];
  cache: "hit" | "miss" | "not-applicable";
  durationMs: number;
};

export type RetrievalExpectation = {
  queryId: string;
  relevantEvidenceIds: string[];
};

export type RetrievalQualityReport = {
  schemaVersion: 1;
  status: "not-configured" | "measured";
  coverage: number | null;
  relevanceRate: number | null;
  cacheHitRate: number | null;
  score: { min: number; max: number; mean: number } | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  missingQueryCount: number;
};
