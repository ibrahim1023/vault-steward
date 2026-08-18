# Upgrade Notes

## 0.1.0

Vault Steward is distributed as a desktop-only Obsidian plugin directory containing `main.js`, `manifest.json`, `styles.css`, and `release-manifest.json`. The SQLite WebAssembly runtime is embedded in `main.js`, so Community Plugins installation requires no additional runtime file.

### Install or upgrade

1. Close or disable the existing Vault Steward plugin in Obsidian.
2. Keep a copy of any prepared repair details before upgrading; source changes
   make prior proposals stale and require a fresh preview and approval.
3. Replace the contents of `.obsidian/plugins/vault-steward/` with the packaged release directory.
4. Re-enable the plugin and open Vault Steward from the left-ribbon shield icon or the `Open Vault Steward status` command-palette command.

The release manifest records SHA-256 hashes for every install artifact. The local SQLite database remains in the plugin data directory and is migrated forward on startup. Do not copy database files between unrelated vaults. To remove the plugin, disable it and delete only `.obsidian/plugins/vault-steward/`; this does not modify vault notes.

An existing `.vault-steward/policy.yaml` remains supported for deterministic
policy checks. When it is missing, Vault Steward uses a starter default. An
invalid, unreadable, or oversized existing policy file stops a scan until it is
restored or removed; then run **Check vault** again.

Selected-finding explanations and model readiness checks use the configured
provider and do not grant it vault search or write access. If an apply enters a
recovery-required state, review and re-index the affected files before creating
a fresh preview and approval.

### Uninstall

To remove the plugin, disable it and delete only
`.obsidian/plugins/vault-steward/`; this does not modify vault notes.
