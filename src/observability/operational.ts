export type OperationalSample = {
  scanDurationMs: number;
  parseErrors: number;
  modelLatencyMs: number;
  tokenUsage: number;
  toolCalls: number;
  retries: number;
  incomplete: boolean;
  findingVolume: number;
  staleProposals: number;
  applyAttempts: number;
  applyFailures: number;
};

export type OperationalMetrics = {
  scanDurationMs: number;
  parseErrors: number;
  modelLatencyMs: number;
  tokenUsage: number;
  toolCalls: number;
  retryRate: number;
  incompleteRate: number;
  findingVolume: number;
  staleProposals: number;
  applyFailureRate: number;
};

export type OperationalBaseline = {
  schemaVersion: 1;
  maxScanDurationMs: number;
  maxParseErrors: number;
  maxModelLatencyMs: number;
  maxTokenUsage: number;
  maxToolCalls: number;
  maxRetryRate: number;
  maxIncompleteRate: number;
  maxFindingVolume: number;
  maxStaleProposals: number;
  maxApplyFailureRate: number;
};

export function summarizeOperationalMetrics(
  samples: readonly OperationalSample[]
): OperationalMetrics {
  if (samples.length === 0) throw new Error("operational metrics require at least one sample");
  const total = samples.reduce(
    (sum, sample) => ({
      scanDurationMs: sum.scanDurationMs + sample.scanDurationMs,
      parseErrors: sum.parseErrors + sample.parseErrors,
      modelLatencyMs: sum.modelLatencyMs + sample.modelLatencyMs,
      tokenUsage: sum.tokenUsage + sample.tokenUsage,
      toolCalls: sum.toolCalls + sample.toolCalls,
      retries: sum.retries + sample.retries,
      incomplete: sum.incomplete + Number(sample.incomplete),
      findingVolume: sum.findingVolume + sample.findingVolume,
      staleProposals: sum.staleProposals + sample.staleProposals,
      applyAttempts: sum.applyAttempts + sample.applyAttempts,
      applyFailures: sum.applyFailures + sample.applyFailures
    }),
    {
      scanDurationMs: 0,
      parseErrors: 0,
      modelLatencyMs: 0,
      tokenUsage: 0,
      toolCalls: 0,
      retries: 0,
      incomplete: 0,
      findingVolume: 0,
      staleProposals: 0,
      applyAttempts: 0,
      applyFailures: 0
    }
  );
  return {
    scanDurationMs: total.scanDurationMs / samples.length,
    parseErrors: total.parseErrors / samples.length,
    modelLatencyMs: total.modelLatencyMs / samples.length,
    tokenUsage: total.tokenUsage / samples.length,
    toolCalls: total.toolCalls / samples.length,
    retryRate: total.retries / samples.length,
    incompleteRate: total.incomplete / samples.length,
    findingVolume: total.findingVolume / samples.length,
    staleProposals: total.staleProposals / samples.length,
    applyFailureRate: total.applyAttempts === 0 ? 0 : total.applyFailures / total.applyAttempts
  };
}

export function evaluateOperationalBaseline(
  baseline: OperationalBaseline,
  metrics: OperationalMetrics
): string[] {
  const limits: Array<[keyof OperationalMetrics, number]> = [
    ["scanDurationMs", baseline.maxScanDurationMs],
    ["parseErrors", baseline.maxParseErrors],
    ["modelLatencyMs", baseline.maxModelLatencyMs],
    ["tokenUsage", baseline.maxTokenUsage],
    ["toolCalls", baseline.maxToolCalls],
    ["retryRate", baseline.maxRetryRate],
    ["incompleteRate", baseline.maxIncompleteRate],
    ["findingVolume", baseline.maxFindingVolume],
    ["staleProposals", baseline.maxStaleProposals],
    ["applyFailureRate", baseline.maxApplyFailureRate]
  ];
  return limits.flatMap(([name, limit]) =>
    metrics[name] > limit ? [`${name} exceeded baseline`] : []
  );
}
