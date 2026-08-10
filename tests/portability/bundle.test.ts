import { describe, expect, it } from "vitest";
import { createPortableBundle, parsePortableBundle } from "../../src/portability/bundle.js";
import { DEFAULT_PLUGIN_SETTINGS } from "../../src/plugin/settings.js";
describe("portable bundle", () =>
  it("redacts endpoint and accepts only bounded versioned input", () => {
    const bundle = createPortableBundle({
      settings: DEFAULT_PLUGIN_SETTINGS,
      policy: "id: p",
      decisions: []
    });
    expect(JSON.stringify(bundle)).not.toContain("127.0.0.1");
    expect(parsePortableBundle(JSON.stringify(bundle))).toMatchObject({ ok: true });
    expect(parsePortableBundle("{}")).toMatchObject({ ok: false });
  }));

describe("portable bundle cloud settings", () =>
  it("never exports an OpenAI API key or provider origin", () => {
    const bundle = createPortableBundle({
      settings: {
        ...DEFAULT_PLUGIN_SETTINGS,
        cloudModelConsents: { openai: true },
        modelProvider: {
          kind: "openai",
          endpoint: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          apiKey: "sk-secret",
          timeoutMs: 30_000,
          maxResponseBytes: 1_000_000
        }
      },
      policy: "id: p",
      decisions: []
    });
    expect(JSON.stringify(bundle)).not.toContain("sk-secret");
    expect(JSON.stringify(bundle)).not.toContain("api.openai.com");
  }));
