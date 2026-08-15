export type LocalProviderKind = "ollama" | "llama.cpp";
export type OpenAIProviderKind = "openai";
export type HyperFusionProviderKind = "hyperfusion";
export type CloudProviderKind = OpenAIProviderKind | HyperFusionProviderKind;
export type ModelProviderKind = LocalProviderKind | CloudProviderKind;
export type LocalProviderConfig = {
  kind: LocalProviderKind;
  endpoint: string;
  model: string;
  timeoutMs: number;
  maxResponseBytes: number;
};
export type OpenAIProviderConfig = {
  kind: OpenAIProviderKind;
  endpoint: typeof OPENAI_API_BASE_URL;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxResponseBytes: number;
};
export type HyperFusionProviderConfig = {
  kind: HyperFusionProviderKind;
  endpoint: typeof HYPERFUSION_API_BASE_URL;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxResponseBytes: number;
};
export type ModelProviderConfig =
  LocalProviderConfig | OpenAIProviderConfig | HyperFusionProviderConfig;
export type LocalGenerationRequest = {
  prompt: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
};
export type LocalGeneration = {
  text: string;
  model: string;
  provider: ModelProviderKind;
  latencyMs: number;
};
export type ModelProvider = {
  readonly config: ModelProviderConfig;
  readonly capabilities: readonly string[];
  generate(request: LocalGenerationRequest): Promise<LocalGeneration>;
};
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const MAX_PROVIDER_TIMEOUT_MS = 10 * 60 * 1_000;
export const MAX_PROVIDER_RESPONSE_BYTES = 10 * 1_024 * 1_024;
export const MAX_PROVIDER_OUTPUT_TOKENS = 4_096;
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
export const HYPERFUSION_API_BASE_URL = "https://api.hyperfusion.io/v1";

export function createLocalProvider(
  config: LocalProviderConfig,
  fetcher: FetchLike = fetch
): ModelProvider {
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

export function createOpenAIProvider(
  config: OpenAIProviderConfig,
  fetcher: FetchLike = fetch
): ModelProvider {
  validateOpenAIConfig(config, true);
  return createProvider(config, fetcher, {
    endpoint: `${OPENAI_API_BASE_URL}/responses`,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: (request) => openAIBody(config, request),
    output: openAIOutput
  });
}

export function createHyperFusionProvider(
  config: HyperFusionProviderConfig,
  fetcher: FetchLike = fetch
): ModelProvider {
  validateHyperFusionConfig(config, true);
  return createProvider(config, fetcher, {
    endpoint: `${HYPERFUSION_API_BASE_URL}/chat/completions`,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: (request) => hyperFusionBody(config, request),
    output: hyperFusionOutput
  });
}

export function createModelProvider(
  config: ModelProviderConfig,
  fetcher: FetchLike = fetch
): ModelProvider {
  if (config.kind === "openai") return createOpenAIProvider(config, fetcher);
  if (config.kind === "hyperfusion") return createHyperFusionProvider(config, fetcher);
  return createLocalProvider(config, fetcher);
}

export function selectProvider(
  providers: readonly ModelProvider[],
  capability: string
): ModelProvider | null {
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

export function isValidModelProviderConfig(value: unknown): value is ModelProviderConfig {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<ModelProviderConfig>;
  try {
    if (candidate.kind === "openai") {
      validateOpenAIConfig(candidate as OpenAIProviderConfig, false);
    } else if (candidate.kind === "hyperfusion") {
      validateHyperFusionConfig(candidate as HyperFusionProviderConfig, false);
    } else if (candidate.kind === "ollama" || candidate.kind === "llama.cpp") {
      validateConfig(candidate as LocalProviderConfig);
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validateOpenAIConfig(config: OpenAIProviderConfig, requireApiKey: boolean): void {
  if (
    config.endpoint !== OPENAI_API_BASE_URL ||
    !config.model.trim() ||
    typeof config.apiKey !== "string" ||
    config.apiKey.length > 1_024 ||
    (requireApiKey && !config.apiKey.trim()) ||
    !isBoundedPositiveInteger(config.timeoutMs, MAX_PROVIDER_TIMEOUT_MS) ||
    !isBoundedPositiveInteger(config.maxResponseBytes, MAX_PROVIDER_RESPONSE_BYTES)
  )
    throw new Error("OpenAI provider configuration is invalid");
}

function validateHyperFusionConfig(
  config: HyperFusionProviderConfig,
  requireApiKey: boolean
): void {
  if (
    config.endpoint !== HYPERFUSION_API_BASE_URL ||
    !config.model.trim() ||
    typeof config.apiKey !== "string" ||
    config.apiKey.length > 1_024 ||
    (requireApiKey && !config.apiKey.trim()) ||
    !isBoundedPositiveInteger(config.timeoutMs, MAX_PROVIDER_TIMEOUT_MS) ||
    !isBoundedPositiveInteger(config.maxResponseBytes, MAX_PROVIDER_RESPONSE_BYTES)
  )
    throw new Error("HyperFusion provider configuration is invalid");
}

function createProvider(
  config: ModelProviderConfig,
  fetcher: FetchLike,
  requestConfig: {
    endpoint: string;
    headers: Record<string, string>;
    body: (request: LocalGenerationRequest) => unknown;
    output: (value: unknown) => string | null;
  }
): ModelProvider {
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
        const response = await fetcher(requestConfig.endpoint, {
          method: "POST",
          headers: requestConfig.headers,
          signal: controller.signal,
          redirect: "error",
          body: JSON.stringify(requestConfig.body(request))
        });
        if (timedOut) throw new Error("provider timed out");
        if (!response.ok) throw new Error(`provider unavailable (${response.status})`);
        if (response.redirected) throw new Error("provider redirect rejected");
        const text = await readResponseText(response, config.maxResponseBytes, controller.signal);
        if (timedOut) throw new Error("provider timed out");
        const parsed: unknown = JSON.parse(text);
        const output = requestConfig.output(parsed);
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
        // Thinking-capable Ollama models otherwise enable it by default.
        think: false,
        options: { num_predict: request.maxOutputTokens }
      }
    : { prompt: request.prompt, n_predict: request.maxOutputTokens };
}

function openAIBody(config: OpenAIProviderConfig, request: LocalGenerationRequest): unknown {
  if (!isBoundedPositiveInteger(request.maxOutputTokens, MAX_PROVIDER_OUTPUT_TOKENS)) {
    throw new Error("provider output token limit is invalid");
  }
  return {
    model: config.model,
    instructions: "Return only a valid JSON object. Do not use tools or external data.",
    input: request.prompt,
    text: { format: { type: "json_object" } },
    max_output_tokens: request.maxOutputTokens,
    store: false
  };
}

function hyperFusionBody(
  config: HyperFusionProviderConfig,
  request: LocalGenerationRequest
): unknown {
  if (!isBoundedPositiveInteger(request.maxOutputTokens, MAX_PROVIDER_OUTPUT_TOKENS)) {
    throw new Error("provider output token limit is invalid");
  }
  return {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "Return only a valid JSON object. Do not include reasoning, commentary, tools, or external data."
      },
      { role: "user", content: request.prompt }
    ],
    max_tokens: request.maxOutputTokens,
    // Qwen's OpenAI-compatible serving contract passes the hard switch to the chat template.
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_object" }
  };
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

function openAIOutput(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return null;

  const outputText = record.output.flatMap((item) => {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") {
      return [];
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((part) =>
      part &&
      typeof part === "object" &&
      (part as { type?: unknown }).type === "output_text" &&
      typeof (part as { text?: unknown }).text === "string"
        ? [(part as { text: string }).text]
        : []
    );
  });
  return outputText.length > 0 ? outputText.join("") : null;
}

function hyperFusionOutput(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown } | undefined)?.message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string" && content.length > 0) return content;

  // HyperFusion currently places non-thinking Qwen JSON in reasoning_content with content: null.
  // Accept only a complete JSON object here; free-form reasoning remains unavailable to callers.
  const reasoningContent = (message as { reasoning_content?: unknown }).reasoning_content;
  if (typeof reasoningContent !== "string") return null;
  const structured = reasoningContent.trim();
  try {
    const parsed: unknown = JSON.parse(structured);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? structured
      : null;
  } catch {
    return null;
  }
}
