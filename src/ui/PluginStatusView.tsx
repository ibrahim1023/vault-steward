export type PluginStatus = "ready" | "scanning" | "unavailable";

export function PluginStatusView({
  vaultLabel,
  status
}: {
  vaultLabel: string;
  status: PluginStatus;
}) {
  return (
    <section aria-label="Vault Steward status">
      <h2>Vault Steward</h2>
      <p>Current vault: {vaultLabel}</p>
      <p role="status" aria-live="polite">
        {statusMessage(status)}
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
  }
}
