import { createHash } from "node:crypto";

import type { ModelProvider } from "../model-provider/local-provider.js";
import type { ModelTrace } from "../model-provider/structured.js";
import {
  prepareContradictionPropositions,
  runContradictionAgent,
  runDecisionAgent,
  runEntityAgent,
  runStalenessAgent,
  type AgentEvidence,
  type ContradictionProposition,
  type StalenessRecord
} from "./model-assisted.js";

export type CoordinatorInput = {
  scanId: string;
  now: string;
  evidence: readonly AgentEvidence[];
  propositions: readonly ContradictionProposition[];
  stalenessRecords: readonly StalenessRecord[];
  decisions: readonly {
    id: string;
    rationale: string | null;
    supersedes: string | null;
    evidence: AgentEvidence;
  }[];
};
export type CoordinatorResult = {
  modelRequired: true;
  modelAvailable: boolean;
  completed: boolean;
  routes: Array<"entity" | "contradiction" | "staleness" | "decision">;
  handoffs: Array<{
    agent: "entity" | "contradiction" | "staleness" | "decision";
    evidenceCount: number;
  }>;
  candidates: unknown[];
  limitations: string[];
  traces: ModelTrace[];
  toolCalls: number;
  reusedRoutes: Array<"entity" | "contradiction" | "staleness" | "decision">;
  terminated: true;
};

type AgentRoute = CoordinatorResult["routes"][number];
type CachedRouteResult = {
  candidates: unknown[];
  limitations: string[];
};

export class AgentResultCache {
  private readonly values = new Map<string, CachedRouteResult>();

  get(route: AgentRoute, context: unknown): CachedRouteResult | undefined {
    return this.values.get(cacheKey(route, context));
  }

  set(route: AgentRoute, context: unknown, result: CachedRouteResult): void {
    if (result.limitations.includes("local-model-output-unavailable")) return;
    this.values.set(cacheKey(route, context), {
      candidates: [...result.candidates],
      limitations: [...result.limitations]
    });
  }

  clear(): void {
    this.values.clear();
  }
}

export class LocalAgentCoordinator {
  constructor(
    private readonly providers: readonly ModelProvider[],
    private readonly cache: AgentResultCache = new AgentResultCache()
  ) {}

  async run(input: CoordinatorInput): Promise<CoordinatorResult> {
    if (this.providers.length === 0) {
      return {
        modelRequired: true,
        modelAvailable: false,
        completed: false,
        routes: [],
        handoffs: [],
        candidates: [],
        limitations: ["local-model-provider-required"],
        traces: [],
        toolCalls: 0,
        reusedRoutes: [],
        terminated: true
      };
    }
    const routes = selectRoutes(input);
    const handoffs: CoordinatorResult["handoffs"] = [];
    const candidates: unknown[] = [];
    const limitations: string[] = [];
    const traces: ModelTrace[] = [];
    const reusedRoutes: AgentRoute[] = [];
    let toolCalls = 0;

    for (const route of routes) {
      if (route === "entity") {
        handoffs.push({ agent: route, evidenceCount: input.evidence.length });
        const result = await this.runCached(
          route,
          { evidence: input.evidence },
          () => runEntityAgent({ scanId: input.scanId, evidence: input.evidence }, this.providers),
          reusedRoutes
        );
        toolCalls += result.traces.length > 0 ? 1 : 0;
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
        traces.push(...result.traces);
      } else if (route === "contradiction") {
        const propositions = prepareContradictionPropositions(input.propositions);
        handoffs.push({ agent: route, evidenceCount: propositions.length });
        const result = await this.runCached(
          route,
          { propositions },
          () =>
            runContradictionAgent(
              { scanId: input.scanId, evidence: input.evidence, propositions },
              this.providers
            ),
          reusedRoutes
        );
        toolCalls += result.traces.length > 0 ? 1 : 0;
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
        traces.push(...result.traces);
      } else if (route === "staleness") {
        handoffs.push({ agent: route, evidenceCount: input.stalenessRecords.length });
        const result = await this.runCached(
          route,
          { now: input.now, records: input.stalenessRecords },
          () =>
            runStalenessAgent(
              { scanId: input.scanId, now: input.now, records: input.stalenessRecords },
              this.providers
            ),
          reusedRoutes
        );
        toolCalls += result.traces.length > 0 ? 1 : 0;
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
        traces.push(...result.traces);
      } else {
        handoffs.push({ agent: route, evidenceCount: input.decisions.length });
        const result = await this.runCached(
          route,
          { decisions: input.decisions },
          () =>
            runDecisionAgent({ scanId: input.scanId, decisions: input.decisions }, this.providers),
          reusedRoutes
        );
        toolCalls += result.traces.length > 0 ? 1 : 0;
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
        traces.push(...result.traces);
      }
    }
    return {
      modelRequired: true,
      modelAvailable: true,
      completed: !limitations.includes("local-model-output-unavailable"),
      routes,
      handoffs,
      candidates: dedupeCandidates(candidates),
      limitations: [...new Set(limitations)],
      traces,
      toolCalls,
      reusedRoutes,
      terminated: true
    };
  }

  private async runCached(
    route: AgentRoute,
    context: unknown,
    run: () => Promise<{ candidates: unknown[]; limitations: string[]; traces: ModelTrace[] }>,
    reusedRoutes: AgentRoute[]
  ): Promise<{ candidates: unknown[]; limitations: string[]; traces: ModelTrace[] }> {
    const cached = this.cache.get(route, providerScopedContext(this.providers, context));
    if (cached) {
      reusedRoutes.push(route);
      return { ...cached, traces: [] };
    }
    const result = await run();
    this.cache.set(route, providerScopedContext(this.providers, context), result);
    return result;
  }
}

function selectRoutes(input: CoordinatorInput): CoordinatorResult["routes"] {
  const routes: CoordinatorResult["routes"] = [];
  if (input.evidence.length > 0) routes.push("entity");
  if (prepareContradictionPropositions(input.propositions).length >= 2)
    routes.push("contradiction");
  if (input.stalenessRecords.length > 0) routes.push("staleness");
  if (input.decisions.some((decision) => !decision.rationale || decision.supersedes))
    routes.push("decision");
  return routes;
}

function dedupeCandidates(candidates: readonly unknown[]): unknown[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function providerScopedContext(providers: readonly ModelProvider[], context: unknown): unknown {
  return {
    providers: providers.map((provider) => ({
      kind: provider.config.kind,
      endpoint: provider.config.endpoint,
      model: provider.config.model
    })),
    context
  };
}

function cacheKey(route: AgentRoute, context: unknown): string {
  return createHash("sha256").update(route).update(JSON.stringify(context)).digest("hex");
}
