import { assembleEvidenceContext, type EvidenceInput } from "../model-provider/context.js";
import type { ModelProvider } from "../model-provider/local-provider.js";
import { generateStructured, type ModelTrace } from "../model-provider/structured.js";

export type AgentEvidence = EvidenceInput;
export type EntityCandidate = {
  kind: "alias" | "duplicate" | "inconsistent-name";
  labels: [string, string];
  evidence: [AgentEvidence, AgentEvidence];
};
export type ContradictionProposition = AgentEvidence & { statement: string };
export type ContradictionCandidate = {
  left: ContradictionProposition;
  right: ContradictionProposition;
  explanation: string;
  severity: "low";
};
export type StalenessRecord = AgentEvidence & {
  updatedAt: string;
  projectStatus: string;
  archival: boolean;
};
export type StalenessCandidate = { evidence: AgentEvidence; explanation: string };
export type DecisionCandidate = {
  decisionId: string;
  evidence: AgentEvidence;
  explanation: string;
};
export type AgentRun<T> = { candidates: T[]; limitations: string[]; traces: ModelTrace[] };

type EntityOutput = { candidates: unknown[] };
type ContradictionOutput = { candidates: unknown[] };
type StalenessOutput = { candidates: unknown[] };
type DecisionOutput = { candidates: unknown[] };

const DEFAULT_BUDGET = { maxInputTokens: 8_000, maxEntries: 20 };

export function validateEntityCandidates(
  candidates: readonly unknown[],
  activeEvidence: readonly AgentEvidence[]
): EntityCandidate[] {
  return candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || !isEntityKind(candidate.kind) || !isLabelPair(candidate.labels))
      return [];
    const evidence = tupleEvidence(candidate.evidence);
    if (!evidence || !evidence.every((item) => includesEvidence(activeEvidence, item))) return [];
    if (evidenceKey(evidence[0]) === evidenceKey(evidence[1])) return [];
    if (normalizeLabel(candidate.labels[0]) === normalizeLabel(candidate.labels[1])) return [];
    return [{ kind: candidate.kind, labels: candidate.labels, evidence }];
  });
}

export async function runEntityAgent(
  input: { scanId: string; evidence: readonly AgentEvidence[] },
  providers: readonly ModelProvider[]
): Promise<AgentRun<EntityCandidate>> {
  const response = await generateAgentOutput<EntityOutput>(
    "entity",
    input.scanId,
    input.evidence,
    providers,
    isOutput
  );
  return {
    candidates: response.value
      ? validateEntityCandidates(response.value.candidates, input.evidence)
      : [],
    limitations: response.limitations,
    traces: response.traces
  };
}

export function prepareContradictionPropositions(
  entries: readonly ContradictionProposition[]
): ContradictionProposition[] {
  return entries.filter(
    (entry) =>
      entry.statement.trim().length > 0 &&
      entry.statement.length <= 500 &&
      entry.notePath.length > 0 &&
      entry.locator.length > 0
  );
}

export async function runContradictionAgent(
  input: {
    scanId: string;
    evidence: readonly AgentEvidence[];
    propositions: readonly ContradictionProposition[];
  },
  providers: readonly ModelProvider[]
): Promise<AgentRun<ContradictionCandidate>> {
  const response = await generateAgentOutput<ContradictionOutput>(
    "contradiction",
    input.scanId,
    input.propositions,
    providers,
    isOutput
  );
  const candidates = response.value
    ? validateContradictions(response.value.candidates, input.propositions)
    : [];
  return { candidates, limitations: response.limitations, traces: response.traces };
}

export async function runStalenessAgent(
  input: { scanId: string; now: string; records: readonly StalenessRecord[] },
  providers: readonly ModelProvider[]
): Promise<AgentRun<StalenessCandidate>> {
  const eligible = input.records.filter((record) => isStalenessEligible(record, input.now));
  const response = await generateAgentOutput<StalenessOutput>(
    "staleness",
    input.scanId,
    eligible,
    providers,
    isOutput
  );
  const candidates = response.value
    ? response.value.candidates.flatMap((candidate) =>
        validateStalenessCandidate(candidate, eligible)
      )
    : [];
  return { candidates, limitations: response.limitations, traces: response.traces };
}

export async function runDecisionAgent(
  input: {
    scanId: string;
    decisions: readonly {
      id: string;
      rationale: string | null;
      supersedes: string | null;
      evidence: AgentEvidence;
    }[];
  },
  providers: readonly ModelProvider[]
): Promise<AgentRun<DecisionCandidate>> {
  const ambiguous = input.decisions.filter(
    (decision) => !decision.rationale || Boolean(decision.supersedes)
  );
  const response = await generateAgentOutput<DecisionOutput>(
    "decision",
    input.scanId,
    ambiguous.map((decision) => decision.evidence),
    providers,
    isOutput
  );
  const candidates = response.value
    ? response.value.candidates.flatMap((candidate) =>
        validateDecisionCandidate(candidate, ambiguous)
      )
    : [];
  return { candidates, limitations: response.limitations, traces: response.traces };
}

async function generateAgentOutput<T extends { candidates: unknown[] }>(
  agent: string,
  scanId: string,
  evidence: readonly AgentEvidence[],
  providers: readonly ModelProvider[],
  validate: (value: unknown) => value is T
): Promise<{ value: T | null; limitations: string[]; traces: ModelTrace[] }> {
  const context = assembleEvidenceContext({ scanId, evidence, policyIds: [], ...DEFAULT_BUDGET });
  const result = await generateStructured(
    providers,
    {
      prompt: `${context.text}\nReturn JSON: {"candidates":[]}. Agent: ${agent}. Cite only supplied evidence.`,
      maxOutputTokens: 1_000
    },
    validate
  );
  if (!result.ok) {
    return { value: null, limitations: ["local-model-output-unavailable"], traces: result.trace };
  }
  return {
    value: result.value,
    limitations: context.truncated ? ["evidence-context-truncated"] : [],
    traces: [result.trace]
  };
}

function validateContradictions(
  candidates: readonly unknown[],
  propositions: readonly ContradictionProposition[]
): ContradictionCandidate[] {
  return candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate.explanation !== "string") return [];
    const left = proposition(candidate.left);
    const right = proposition(candidate.right);
    if (
      !left ||
      !right ||
      !includesEvidence(propositions, left) ||
      !includesEvidence(propositions, right)
    )
      return [];
    if (
      evidenceKey(left) === evidenceKey(right) ||
      normalizeLabel(left.statement) === normalizeLabel(right.statement)
    )
      return [];
    return [{ left, right, explanation: candidate.explanation.slice(0, 500), severity: "low" }];
  });
}

function validateStalenessCandidate(
  candidate: unknown,
  eligible: readonly StalenessRecord[]
): StalenessCandidate[] {
  if (!isRecord(candidate) || typeof candidate.explanation !== "string") return [];
  const evidence = evidenceItem(candidate.evidence);
  return evidence && includesEvidence(eligible, evidence)
    ? [{ evidence, explanation: candidate.explanation.slice(0, 500) }]
    : [];
}

function validateDecisionCandidate(
  candidate: unknown,
  decisions: readonly { id: string; evidence: AgentEvidence }[]
): DecisionCandidate[] {
  if (
    !isRecord(candidate) ||
    typeof candidate.decisionId !== "string" ||
    typeof candidate.explanation !== "string"
  )
    return [];
  const decision = decisions.find((item) => item.id === candidate.decisionId);
  const evidence = evidenceItem(candidate.evidence);
  return decision && evidence && evidenceKey(decision.evidence) === evidenceKey(evidence)
    ? [
        {
          decisionId: decision.id,
          evidence: decision.evidence,
          explanation: candidate.explanation.slice(0, 500)
        }
      ]
    : [];
}

function isStalenessEligible(record: StalenessRecord, now: string): boolean {
  const ageMs = Date.parse(now) - Date.parse(record.updatedAt);
  return (
    Number.isFinite(ageMs) &&
    ageMs >= 90 * 24 * 60 * 60 * 1_000 &&
    !record.archival &&
    record.projectStatus !== "archived"
  );
}

function isOutput(value: unknown): value is { candidates: unknown[] } {
  return isRecord(value) && Array.isArray(value.candidates);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isEntityKind(value: unknown): value is EntityCandidate["kind"] {
  return value === "alias" || value === "duplicate" || value === "inconsistent-name";
}
function isLabelPair(value: unknown): value is [string, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}
function evidenceItem(value: unknown): AgentEvidence | null {
  if (
    !isRecord(value) ||
    typeof value.notePath !== "string" ||
    typeof value.locator !== "string" ||
    typeof value.excerpt !== "string"
  )
    return null;
  return { notePath: value.notePath, locator: value.locator, excerpt: value.excerpt };
}
function tupleEvidence(value: unknown): [AgentEvidence, AgentEvidence] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const first = evidenceItem(value[0]);
  const second = evidenceItem(value[1]);
  return first && second ? [first, second] : null;
}
function proposition(value: unknown): ContradictionProposition | null {
  const evidence = evidenceItem(value);
  return evidence && isRecord(value) && typeof value.statement === "string"
    ? { ...evidence, statement: value.statement }
    : null;
}
function includesEvidence(haystack: readonly AgentEvidence[], needle: AgentEvidence): boolean {
  return haystack.some((item) => evidenceKey(item) === evidenceKey(needle));
}
function evidenceKey(value: AgentEvidence): string {
  return `${value.notePath}:${value.locator}`;
}
function normalizeLabel(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}
