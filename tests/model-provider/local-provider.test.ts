import { describe, expect, it, vi } from "vitest";

import { createLocalProvider, selectProvider } from "../../src/model-provider/local-provider.js";

describe("local model providers", () => {
  it("selects configured capabilities and rejects non-local endpoints", () => {
    const provider = createLocalProvider({
      kind: "ollama",
      endpoint: "http://127.0.0.1:11434",
      model: "qwen",
      timeoutMs: 100,
      maxResponseBytes: 1000
    });
    expect(selectProvider([provider], "structured-output")).toBe(provider);
    expect(() =>
      createLocalProvider({
        kind: "ollama",
        endpoint: "https://example.com",
        model: "qwen",
        timeoutMs: 100,
        maxResponseBytes: 1000
      })
    ).toThrow("loopback");
  });
  it("fails closed for unavailable, oversized, and timed-out responses", async () => {
    const unavailable = createLocalProvider(
      {
        kind: "llama.cpp",
        endpoint: "http://localhost:8080",
        model: "local",
        timeoutMs: 20,
        maxResponseBytes: 10
      },
      vi.fn().mockRejectedValue(new Error("offline"))
    );
    await expect(unavailable.generate({ prompt: "x", maxOutputTokens: 5 })).rejects.toThrow(
      "unavailable"
    );
    const oversized = createLocalProvider(
      {
        kind: "ollama",
        endpoint: "http://localhost:11434",
        model: "local",
        timeoutMs: 20,
        maxResponseBytes: 2
      },
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: "long" })))
    );
    await expect(oversized.generate({ prompt: "x", maxOutputTokens: 5 })).rejects.toThrow(
      "response size"
    );
    const hanging = createLocalProvider(
      {
        kind: "ollama",
        endpoint: "http://localhost:11434",
        model: "local",
        timeoutMs: 1,
        maxResponseBytes: 1000
      },
      (_url, init) =>
        new Promise((_resolve, reject) =>
          (init?.signal as AbortSignal).addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          )
        )
    );
    await expect(hanging.generate({ prompt: "x", maxOutputTokens: 5 })).rejects.toThrow(
      "timed out"
    );
  });
  it("asks Ollama for native JSON output", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: "{}" })));
    const provider = createLocalProvider(
      {
        kind: "ollama",
        endpoint: "http://localhost:11434",
        model: "local",
        timeoutMs: 20,
        maxResponseBytes: 1000
      },
      fetcher
    );
    await provider.generate({ prompt: "x", maxOutputTokens: 5 });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      format: "json",
      think: false
    });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  it("rejects redirect responses and invalid resource limits before model data can escape", async () => {
    const redirecting = createLocalProvider(
      {
        kind: "ollama",
        endpoint: "http://localhost:11434",
        model: "local",
        timeoutMs: 20,
        maxResponseBytes: 1000
      },
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 307, headers: { location: "https://example.com" } })
        )
    );
    await expect(
      redirecting.generate({ prompt: "vault evidence", maxOutputTokens: 5 })
    ).rejects.toThrow("unavailable");
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 20_000_000]) {
      expect(() =>
        createLocalProvider({
          kind: "ollama",
          endpoint: "http://localhost:11434",
          model: "local",
          timeoutMs: value,
          maxResponseBytes: 1000
        })
      ).toThrow("configuration");
    }
  });

  it("rejects declared oversized bodies and invalid output budgets", async () => {
    const provider = createLocalProvider(
      {
        kind: "ollama",
        endpoint: "http://localhost:11434",
        model: "local",
        timeoutMs: 20,
        maxResponseBytes: 10
      },
      vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-length": "100" } }))
    );
    await expect(provider.generate({ prompt: "x", maxOutputTokens: 5 })).rejects.toThrow(
      "response size"
    );
    await expect(provider.generate({ prompt: "x", maxOutputTokens: 0 })).rejects.toThrow(
      "unavailable"
    );
  });
});
