# Release Compatibility

Vault Steward targets Obsidian desktop 1.5.0 or newer. Release validation is
currently limited to macOS; Windows and Linux have not been validated. Node.js
20 or newer is required only for repository development and packaging. The
package smoke test verifies the release directory contains `main.js`,
`manifest.json`, `styles.css`, `sql-wasm.wasm`, and `release-manifest.json`.

The release path is local-first: Ollama is the provider under release
validation. HyperFusion has a passing redacted synthetic-corpus report but
still needs manual macOS acceptance before it can be described as supported.
OpenAI is experimental and requires its own quality and manual evidence.

Before a wider release, run the package/install smoke test, migration/rollback
checks, the desktop accessibility protocol, and the Northstar acceptance suite.
The suite covers the result-first Current/After preview, batch approval, stale
abort, actual result, Settings, History, Diagnostics, and Ollama recovery.
Automated package checks and manual desktop checks are separate evidence;
neither substitutes for the other.

See `docs/upgrade-notes.md` for install, upgrade, and uninstall procedures.
