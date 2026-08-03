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
  let sawInvalidOutput = false;
  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const generation = await provider.generate({
          ...request,
          prompt:
            attempt === 0 || !sawInvalidOutput
              ? request.prompt
              : `${request.prompt}\nPrevious output was invalid. Return exactly one JSON object matching the requested schema. Do not include commentary, Markdown fences, or thinking.`
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
        sawInvalidOutput = true;
      } catch {
        traces.push({
          provider: provider.config.kind,
          model: provider.config.model,
          latencyMs: 0,
          retries: attempt,
          outcome: "failure"
        });
      }
    }
  }
  return {
    ok: false,
    error: sawInvalidOutput ? "structured-output-invalid" : "provider-unavailable",
    trace: traces
  };
}

function parse(text: string): unknown {
  const direct = parseJson(text.trim());
  if (direct !== null) return direct;

  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)) {
    const value = parseJson(match[1]?.trim() ?? "");
    if (value !== null) return value;
  }

  return parseFirstJsonValue(text);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function parseFirstJsonValue(text: string): unknown {
  candidate: for (let start = 0; start < text.length; start++) {
    if (text[start] !== "{" && text[start] !== "[") continue;
    let depth = 1;
    let quote = false;
    let escaped = false;
    for (let index = start + 1; index < text.length; index++) {
      const character = text[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quote = false;
        continue;
      }
      if (character === '"') {
        quote = true;
        continue;
      }
      if (character === "{" || character === "[") depth += 1;
      if (character === "}" || character === "]") depth -= 1;
      if (depth !== 0) continue;
      const value = parseJson(text.slice(start, index + 1));
      if (value !== null) return value;
      continue candidate;
    }
  }
  return null;
}
