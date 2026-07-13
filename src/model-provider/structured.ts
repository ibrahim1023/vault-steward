import type { LocalGenerationRequest, LocalProvider } from "./local-provider.js";

export type ModelTrace = {
  provider: string;
  model: string;
  latencyMs: number;
  retries: number;
  outcome: "success" | "failure";
};
export type StructuredResult<T> =
  | { ok: true; value: T; trace: ModelTrace }
  | { ok: false; error: "structured-output-invalid" | "provider-unavailable"; trace: ModelTrace[] };

export async function generateStructured<T>(
  providers: readonly LocalProvider[],
  request: LocalGenerationRequest,
  validate: (value: unknown) => value is T
): Promise<StructuredResult<T>> {
  const traces: ModelTrace[] = [];
  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const generation = await provider.generate({
          ...request,
          prompt: attempt === 0 ? request.prompt : `${request.prompt}\nReturn valid JSON only.`
        });
        const value = parse(generation.text);
        const trace: ModelTrace = {
          provider: generation.provider,
          model: generation.model,
          latencyMs: generation.latencyMs,
          retries: attempt,
          outcome: validate(value) ? "success" : "failure"
        };
        traces.push(trace);
        if (validate(value)) return { ok: true, value, trace };
      } catch {
        traces.push({
          provider: provider.config.kind,
          model: provider.config.model,
          latencyMs: 0,
          retries: attempt,
          outcome: "failure"
        });
        break;
      }
    }
  }
  return {
    ok: false,
    error: traces.length === 0 ? "provider-unavailable" : "structured-output-invalid",
    trace: traces
  };
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
