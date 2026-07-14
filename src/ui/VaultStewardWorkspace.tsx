import { useState } from "react";

import type { Finding } from "../contracts/index.js";
import { PluginStatusView, type PluginStatus } from "./PluginStatusView.js";
import { ReviewQueueView, type ReviewQueueStatus } from "./ReviewQueueView.js";

export function VaultStewardWorkspace({
  vaultLabel,
  scan
}: {
  vaultLabel: string;
  scan: () => Promise<{ scanId: string; findings: Finding[] }>;
}) {
  const [status, setStatus] = useState<PluginStatus>("ready");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const runScan = async () => {
    setStatus("scanning");
    setErrorMessage(undefined);
    try {
      const result = await scan();
      setFindings(result.findings);
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
      <ReviewQueueView
        status={reviewStatus}
        findings={findings}
        {...(errorMessage ? { errorMessage } : {})}
      />
    </section>
  );
}
