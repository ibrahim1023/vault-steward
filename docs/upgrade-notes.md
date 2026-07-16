# Upgrade Notes

## 0.1.0

Vault Steward is distributed as a desktop-only Obsidian plugin directory containing `main.js`, `manifest.json`, `sql-wasm.wasm`, `styles.css`, and `release-manifest.json`.

1. Close or disable the existing Vault Steward plugin in Obsidian.
2. Replace the contents of `.obsidian/plugins/vault-steward/` with the packaged release directory.
3. Re-enable the plugin and open Vault Steward from the left-ribbon shield icon or the `Open Vault Steward status` command-palette command.

The release manifest records SHA-256 hashes for every install artifact. The local SQLite database remains in the plugin data directory and is migrated forward on startup. Do not copy database files between unrelated vaults. To remove the plugin, disable it and delete only `.obsidian/plugins/vault-steward/`; this does not modify vault notes.

Policy Studio stores the active policy at `.vault-steward/policy.yaml` only after an explicit Save. Use a completed scan before previewing policy violations. Selected-finding explanations and model readiness checks use the configured local provider and do not grant the model vault search or write access.
