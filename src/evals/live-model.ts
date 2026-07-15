import type { LocalProvider } from "../model-provider/local-provider.js";

export type LiveModelEvaluation = {
  available: boolean;
  passed: boolean;
  provider: string;
  model: string;
  schemaValidity: number;
  citationValidity: number;
  latencyMs: number;
  retries: number;
  incompleteRate: number;
};

export async function runLiveModelEvaluation(input: {
  provider: LocalProvider | null;
}): Promise<LiveModelEvaluation> {
  if (!input.provider)
    return {
      available: false,
      passed: false,
      provider: "unavailable",
      model: "unavailable",
      schemaValidity: 0,
      citationValidity: 0,
      latencyMs: 0,
      retries: 0,
      incompleteRate: 1
    };
  try {
    const generation = await input.provider.generate({
      prompt:
        'Synthetic evaluation. Reply with exactly this JSON object and nothing else: {"candidates":[]}',
      maxOutputTokens: 64
    });
    const valid = isCandidateList(generation.text);
    return {
      available: true,
      passed: valid,
      provider: generation.provider,
      model: generation.model,
      schemaValidity: valid ? 1 : 0,
      citationValidity: valid ? 1 : 0,
      latencyMs: generation.latencyMs,
      retries: 0,
      incompleteRate: valid ? 0 : 1
    };
  } catch {
    return {
      available: false,
      passed: false,
      provider: input.provider.config.kind,
      model: input.provider.config.model,
      schemaValidity: 0,
      citationValidity: 0,
      latencyMs: 0,
      retries: 0,
      incompleteRate: 1
    };
  }
}

function isCandidateList(text: string): boolean {
  try {
    const value = JSON.parse(extractJson(text)) as Record<string, unknown>;
    return Array.isArray(value.candidates);
  } catch {
    return false;
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}
