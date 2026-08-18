# Release Compatibility

Vault Steward targets Obsidian desktop 1.5.0 or newer. Release validation is
currently limited to macOS; Windows and Linux have not been validated. Node.js
20 or newer is required only for repository development and packaging. The
package smoke test verifies the release directory contains `main.js`,
`manifest.json`, `styles.css`, and `release-manifest.json`. SQLite WebAssembly
is embedded in `main.js`, so the official three-file Community Plugins install
does not depend on an additional downloaded asset.

The local-first release path is Ollama. HyperFusion and OpenAI are experimental
opt-in providers, not general release support claims. Both have completed
current macOS manual/provider evidence; HyperFusion has a passing redacted
synthetic-corpus report and OpenAI has recorded provider evidence. Release
validation remains limited to macOS.

Before a wider release, run the package/install smoke test, migration/rollback
checks, the desktop accessibility protocol, and the Northstar acceptance suite.
The suite covers the result-first Current/After preview, batch approval, stale
abort, actual result, Settings, History, Diagnostics, and Ollama recovery.
Automated package checks and manual desktop checks are separate evidence;
neither substitutes for the other.

See `docs/upgrade-notes.md` for install, upgrade, and uninstall procedures.
