# Reviewer-Zero Design

## Goal

Release Vault Steward 0.2.0 with every avoidable Community Directory error, warning, and recommendation removed while preserving the plugin's local-first, approval-only behavior.

## Constraints

- The plugin requires Obsidian desktop 1.13.0 or later so it can use declarative settings.
- GitHub releases contain only `main.js`, `manifest.json`, and `styles.css`.
- Release assets are built and attested by GitHub Actions; a manual release is not a valid 0.2.0 release path.
- The plugin continues to enumerate Markdown files and declares `main: "main.js"`; these are required platform disclosures rather than removable behavior.
- No direct model-provider network call, shell execution, telemetry, or autonomous edits may be introduced.

## Architecture

### UI runtime

Replace React and React DOM with Preact plus `preact/compat`. Keep the existing JSX component interface and test structure through compatibility aliases, but have esbuild resolve `react`, `react-dom`, and `react-dom/client` to Preact. Preact's DOM renderer does not bundle React DOM's script-resource implementation, removing the six static dynamic-script findings from `main.js` without adding a custom script loader.

### Settings

Replace the imperative `PluginSettingTab.display()` implementation with `getSettingDefinitions()`. Each existing control becomes a typed declarative definition whose value comes from plugin settings and whose `setValue` persists through the existing safe settings parser. Provider-dependent settings remain conditional by returning definitions based on the selected provider. Provider selection triggers the supported settings refresh rather than rebuilding DOM manually.

### Static correctness

Remove redundant type assertions and unsafe JSON-derived return paths by using narrow type guards and explicit arrays. Use `window.setTimeout` and `window.clearTimeout` for provider deadlines. Wrap async UI event handlers in synchronous callbacks that intentionally discard returned promises through a local `void` boundary.

### Release provenance

Add a release workflow triggered by a `0.2.0`-style tag. It runs the completion checks, packages exactly the standard artifacts, creates the GitHub release, uploads the assets, and uses GitHub artifact attestations for `main.js` and `styles.css`. The release owner pushes the tag; the workflow creates the public release.

## Verification

- Targeted tests cover declarative settings definitions, timer usage, and Preact bundle invariants.
- Full formatting, lint, typecheck, unit, integration, e2e, evaluation smoke, production audit, package-install smoke, and build checks pass.
- The packaged `main.js` contains no `createElement("script")` or Node filesystem fallback.
- A `v0.2.0` workflow run produces three release assets and attestations; the Community Directory receives that release.
