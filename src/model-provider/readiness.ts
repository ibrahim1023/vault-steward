import type { ModelProvider } from "./local-provider.js";

export type ModelReadiness = {
  available: boolean;
  structuredOutput: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
  maxResponseBytes: number;
  latencyMs: number;
  failureCode?: "provider-unavailable" | "structured-output-invalid";
};

export async function checkModelReadiness(provider: ModelProvider): Promise<ModelReadiness> {
  const base = {
    provider: provider.config.kind,
    model: provider.config.model,
    timeoutMs: provider.config.timeoutMs,
    maxResponseBytes: provider.config.maxResponseBytes
  };
  try {
    const response = await provider.generate({
      prompt: 'Synthetic readiness check. Reply with exactly this JSON object: {"ready":true}.',
      maxOutputTokens: 32
    });
    return isReadyJson(response.text)
      ? { ...base, available: true, structuredOutput: true, latencyMs: response.latencyMs }
      : {
          ...base,
          available: true,
          structuredOutput: false,
          latencyMs: response.latencyMs,
          failureCode: "structured-output-invalid"
        };
  } catch {
    return {
      ...base,
      available: false,
      structuredOutput: false,
      latencyMs: 0,
      failureCode: "provider-unavailable"
    };
  }
}

function isReadyJson(text: string): boolean {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    return value.ready === true;
  } catch {
    return false;
  }
}
