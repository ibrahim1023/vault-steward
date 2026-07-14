import { useEffect, useState } from "react";

import type { Finding } from "../contracts/index.js";
import { PluginStatusView, type PluginStatus } from "./PluginStatusView.js";
import { ReviewQueueView, type ReviewQueueStatus } from "./ReviewQueueView.js";

export function VaultStewardWorkspace({
  vaultLabel,
  scan,
  loadFindings
}: {
  vaultLabel: string;
  scan: () => Promise<{
    scanId: string;
    findings: Finding[];
    completed?: boolean;
    limitations?: string[];
  }>;
  loadFindings?: () => Promise<Finding[]> | Finding[];
}) {
  const [status, setStatus] = useState<PluginStatus>("ready");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!loadFindings) return;
    Promise.resolve(loadFindings())
      .then(setFindings)
      .catch(() => setErrorMessage("The persisted review queue is unavailable."));
  }, [loadFindings]);

  const runScan = async () => {
    setStatus("scanning");
    setErrorMessage(undefined);
    try {
      const result = await scan();
      setFindings(loadFindings ? await loadFindings() : result.findings);
      setStatus("ready");
    } catch {
      setFindings([]);
      setStatus("unavailable");
      setErrorMessage("The scan could not complete.");
    }
  };

  const reviewStatus: ReviewQueueStatus =
    status === "scanning" ? "scanning" : status === "unavailable" ? "error" : "ready";

  return (
    <section aria-label="Vault Steward workspace">
      <PluginStatusView vaultLabel={vaultLabel} status={status} />
      <button type="button" onClick={runScan} disabled={status === "scanning"}>
        Run scan
      </button>
      {status === "ready" ? <p>{findings.length} persisted findings loaded.</p> : null}
      <ReviewQueueView
        status={reviewStatus}
        findings={findings}
        {...(errorMessage ? { errorMessage } : {})}
      />
    </section>
  );
}
