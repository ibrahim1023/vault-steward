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
          body: JSON.stringify(bodyFor(config, request))
        });
        if (!response.ok) throw new Error(`provider unavailable (${response.status})`);
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > config.maxResponseBytes)
          throw new Error("provider response size exceeds configured limit");
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
  if (!config.model || config.timeoutMs < 1 || config.maxResponseBytes < 1)
    throw new Error("provider configuration is invalid");
}
function endpointFor(config: LocalProviderConfig): string {
  return `${config.endpoint.replace(/\/$/, "")}${config.kind === "ollama" ? "/api/generate" : "/completion"}`;
}
function bodyFor(config: LocalProviderConfig, request: LocalGenerationRequest): unknown {
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
function outputFor(config: LocalProviderConfig, value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const output = config.kind === "ollama" ? record.response : record.content;
  return typeof output === "string" ? output : null;
}
