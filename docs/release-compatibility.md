# Release Compatibility

Vault Steward targets Obsidian desktop 1.5.0 or newer and Node.js 20 or newer for repository development/packaging. The package smoke test verifies the release directory contains `main.js`, `manifest.json`, `styles.css`, `sql-wasm.wasm`, and `release-manifest.json`.

Before a wider release, run the package/install smoke test, migration/rollback
checks, the desktop accessibility protocol, and the Northstar acceptance suite.
The suite must cover the result-first Current/After preview, batch approval,
stale abort, actual result, Settings, History, Diagnostics, Ollama, and opt-in
OpenAI paths. Both providers must also pass the same versioned Northstar release
corpus before release support is claimed.
Automated package checks and manual desktop checks are separate evidence;
neither substitutes for the other.

See `docs/upgrade-notes.md` for install, upgrade, and uninstall procedures.
