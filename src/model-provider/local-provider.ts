export type LocalProviderKind = "ollama" | "llama.cpp";
export type LocalProviderConfig = {
  kind: LocalProviderKind;
  endpoint: string;
  model: string;
  timeoutMs: number;
  maxResponseBytes: number;
};
export type LocalGenerationRequest = {
  prompt: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
};
export type LocalGeneration = {
  text: string;
  model: string;
  provider: LocalProviderKind;
  latencyMs: number;
};
export type LocalProvider = {
  readonly config: LocalProviderConfig;
  readonly capabilities: readonly string[];
  generate(request: LocalGenerationRequest): Promise<LocalGeneration>;
};
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const MAX_PROVIDER_TIMEOUT_MS = 10 * 60 * 1_000;
export const MAX_PROVIDER_RESPONSE_BYTES = 10 * 1_024 * 1_024;
export const MAX_PROVIDER_OUTPUT_TOKENS = 4_096;

export function createLocalProvider(
  config: LocalProviderConfig,
  fetcher: FetchLike = fetch
): LocalProvider {
  validateConfig(config);
  return {
    config,
    capabilities: ["structured-output"],
    async generate(request) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, config.timeoutMs);
      const started = Date.now();
      try {
        const response = await fetcher(endpointFor(config), {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          redirect: "error",
          body: JSON.stringify(bodyFor(config, request))
        });
        if (timedOut) throw new Error("provider timed out");
        if (!response.ok) throw new Error(`provider unavailable (${response.status})`);
        if (response.redirected) throw new Error("provider redirect rejected");
        const text = await readResponseText(response, config.maxResponseBytes, controller.signal);
        if (timedOut) throw new Error("provider timed out");
        const parsed: unknown = JSON.parse(text);
        const output = outputFor(config, parsed);
        if (!output) throw new Error("provider returned no text");
        return {
          text: output,
          model: config.model,
          provider: config.kind,
          latencyMs: Date.now() - started
        };
      } catch (error) {
        if (timedOut) throw new Error("provider timed out");
        if (error instanceof Error && error.message.includes("response size")) throw error;
        if (request.signal?.aborted) throw new Error("provider request canceled");
        throw new Error("provider unavailable");
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", onAbort);
      }
    }
  };
}

export function selectProvider(
  providers: readonly LocalProvider[],
  capability: string
): LocalProvider | null {
  return providers.find((provider) => provider.capabilities.includes(capability)) ?? null;
}

function validateConfig(config: LocalProviderConfig): void {
  const url = new URL(config.endpoint);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("provider endpoint must be an unauthenticated http loopback URL");
  if (
    !config.model.trim() ||
    !isBoundedPositiveInteger(config.timeoutMs, MAX_PROVIDER_TIMEOUT_MS) ||
    !isBoundedPositiveInteger(config.maxResponseBytes, MAX_PROVIDER_RESPONSE_BYTES)
  )
    throw new Error("provider configuration is invalid");
}
function endpointFor(config: LocalProviderConfig): string {
  return `${config.endpoint.replace(/\/$/, "")}${config.kind === "ollama" ? "/api/generate" : "/completion"}`;
}
function bodyFor(config: LocalProviderConfig, request: LocalGenerationRequest): unknown {
  if (!isBoundedPositiveInteger(request.maxOutputTokens, MAX_PROVIDER_OUTPUT_TOKENS)) {
    throw new Error("provider output token limit is invalid");
  }
  return config.kind === "ollama"
    ? {
        model: config.model,
        prompt: request.prompt,
        stream: false,
        format: "json",
        options: { num_predict: request.maxOutputTokens }
      }
    : { prompt: request.prompt, n_predict: request.maxOutputTokens };
}

async function readResponseText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("provider response size exceeds configured limit");
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes)
      throw new Error("provider response size exceeds configured limit");
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error("provider request canceled");
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error("provider response size exceeds configured limit");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

function isBoundedPositiveInteger(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= maximum;
}
function outputFor(config: LocalProviderConfig, value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const output = config.kind === "ollama" ? record.response : record.content;
  return typeof output === "string" ? output : null;
}
