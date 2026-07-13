import type { LocalProvider } from "../model-provider/local-provider.js";
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
  toolCalls: number;
  terminated: true;
};

export class LocalAgentCoordinator {
  constructor(private readonly providers: readonly LocalProvider[]) {}

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
        toolCalls: 0,
        terminated: true
      };
    }
    const routes = selectRoutes(input);
    const handoffs: CoordinatorResult["handoffs"] = [];
    const candidates: unknown[] = [];
    const limitations: string[] = [];

    for (const route of routes) {
      if (route === "entity") {
        handoffs.push({ agent: route, evidenceCount: input.evidence.length });
        const result = await runEntityAgent(
          { scanId: input.scanId, evidence: input.evidence },
          this.providers
        );
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
      } else if (route === "contradiction") {
        const propositions = prepareContradictionPropositions(input.propositions);
        handoffs.push({ agent: route, evidenceCount: propositions.length });
        const result = await runContradictionAgent(
          { scanId: input.scanId, evidence: input.evidence, propositions },
          this.providers
        );
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
      } else if (route === "staleness") {
        handoffs.push({ agent: route, evidenceCount: input.stalenessRecords.length });
        const result = await runStalenessAgent(
          { scanId: input.scanId, now: input.now, records: input.stalenessRecords },
          this.providers
        );
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
      } else {
        handoffs.push({ agent: route, evidenceCount: input.decisions.length });
        const result = await runDecisionAgent(
          { scanId: input.scanId, decisions: input.decisions },
          this.providers
        );
        candidates.push(...result.candidates);
        limitations.push(...result.limitations);
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
      toolCalls: routes.length,
      terminated: true
    };
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
