# Troubleshooting

## Model Provider Unavailable

Confirm that Ollama or the compatible local endpoint is running, configured as a loopback address, and has the selected model available. Run the plugin readiness check. A governed scan remains incomplete until the required local semantic stage completes.

For HyperFusion, select `HyperFusion` in Vault Steward settings, enter a valid API key, choose the configured model, and enable the HyperFusion cloud-data acknowledgement. The provider uses only its fixed API origin and sends bounded selected evidence for each semantic request. An OpenAI acknowledgement does not authorize HyperFusion. HyperFusion is experimental.

For OpenAI, select `OpenAI` in Vault Steward settings, enter a valid API key, choose a JSON-capable model, and enable the OpenAI cloud-data acknowledgement. A HyperFusion acknowledgement does not authorize OpenAI. OpenAI is experimental. API keys are stored locally in Obsidian plugin data and are never included in Vault Steward traces or diagnostics. Do not paste a key into a note, policy file, log, or issue report.

## Database Or Migration Failure

Use the recovery procedures in `docs/runbooks.md`. The plugin records bounded diagnostics and supports rebuild paths that preserve protected audit records where possible.

## Plugin Installation Or Upgrade

Rebuild with `npm run package:plugin`, install the complete `dist/vault-steward/` directory, reload Obsidian, and confirm the ribbon/command launcher is present. Consult `docs/upgrade-notes.md` and `docs/release-compatibility.md` before replacing an existing plugin directory.

## Custom Policy File Error

An existing `.vault-steward/policy.yaml` is used for deterministic policy
checks. If it is invalid, unreadable, or oversized, restore a valid file or
remove it to return to the starter default, then run **Check vault** again.

## Failed or Interrupted Apply

Concurrent note edits are preserved: Vault Steward does not overwrite a
changed source revision. If the apply reports recovery-required, review and
re-index the affected files. Before retrying, run a new check and review a
fresh preview; a fresh explicit approval is required.

## Evaluation Reports

Evaluation, replay, and synthetic reports are local files under ignored `evals/reports/`. If a replay says source is unavailable, the historical vault text was intentionally not retained; use fixture replay for reproducible evaluation instead.

## Prepared Repair Rejected

Vault Steward rejects the full selected batch when a source revision changed,
a proposal digest no longer matches, or two selected repairs overlap. Run a new
check, review the updated Current/After preview, and explicitly approve the
new batch. A provider failure never writes a note.
