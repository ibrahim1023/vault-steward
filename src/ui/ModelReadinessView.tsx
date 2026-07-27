import { useState } from "react";

import type { ModelReadiness } from "../model-provider/readiness.js";

export function ModelReadinessView({
  checkReadiness
}: {
  checkReadiness: () => Promise<ModelReadiness>;
}) {
  const [result, setResult] = useState<ModelReadiness>();
  const [loading, setLoading] = useState(false);
  return (
    <section aria-label="Model readiness">
      <h2>Model</h2>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          void checkReadiness()
            .then(setResult)
            .finally(() => setLoading(false));
        }}
      >
        Check readiness
      </button>
      {loading ? <p role="status">Checking model...</p> : null}
      {result ? (
        <p role={result.available && result.structuredOutput ? "status" : "alert"}>
          {result.available && result.structuredOutput ? "Ready" : "Not ready"}: {result.provider} /{" "}
          {result.model}; {result.latencyMs} ms; timeout {result.timeoutMs} ms; response limit{" "}
          {result.maxResponseBytes} bytes.
        </p>
      ) : null}
    </section>
  );
}
