import { createLocalProvider } from "../src/model-provider/local-provider.js";
import { runLiveModelEvaluation } from "../src/evals/live-model.js";

const model = process.env.OLLAMA_MODEL;
const result = await runLiveModelEvaluation({
  provider: model
    ? createLocalProvider({
        kind: "ollama",
        endpoint: "http://127.0.0.1:11434",
        model,
        timeoutMs: 30_000,
        maxResponseBytes: 32_768
      })
    : null
});
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
