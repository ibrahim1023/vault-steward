import { describe, expect, it } from "vitest";
import { runLiveModelEvaluation } from "../../src/evals/live-model.js";

describe("live model evaluation", () => {
  it("reports unavailable providers without attempting a fallback", async () => {
    await expect(runLiveModelEvaluation({ provider: null })).resolves.toMatchObject({
      available: false,
      passed: false
    });
  });
});
