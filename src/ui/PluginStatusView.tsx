export type PluginStatus = "ready" | "scanning" | "error" | "unavailable";

export function PluginStatusView({
  vaultLabel,
  status,
  errorMessage
}: {
  vaultLabel: string;
  status: PluginStatus;
  errorMessage?: string;
}) {
  return (
    <section aria-label="Vault Steward status">
      <h2>Vault Steward</h2>
      <p>Current vault: {vaultLabel}</p>
      <p role={status === "error" ? "alert" : "status"} aria-live="polite">
        {status === "error" && errorMessage ? errorMessage : statusMessage(status)}
      </p>
    </section>
  );
}

function statusMessage(status: PluginStatus): string {
  switch (status) {
    case "ready":
      return "Ready to scan";
    case "scanning":
      return "Scanning references...";
    case "unavailable":
      return "Vault access is unavailable";
    case "error":
      return "The scan could not complete.";
  }
}
