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
