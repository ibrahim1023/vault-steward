# Local Runbooks

Diagnostics are local, bounded, and metadata-only. Use their correlation ID and code to identify an operation; do not add note excerpts, prompts, credentials, or absolute vault paths to logs or issue reports.

## Database Migration Failure

Disable the plugin, preserve the plugin data directory for recovery, and restart Obsidian once. If the failure repeats, rebuild the derived index from vault files after retaining approval and audit records. Do not edit SQLite bytes manually.

## Index Rebuild

Use the rebuild action after a corruption diagnostic or incomplete scan. The rebuild re-reads the selected vault through the narrow adapter and reconstructs derived scan state. Review stale proposals afterward; source revisions may have changed.

## Provider Unavailable

Confirm the configured loopback endpoint is running and that the configured model is installed. A governed scan remains incomplete until the local provider responds with valid structured output. Do not switch to a remote endpoint.

When OpenAI is intentionally selected, confirm the configured model is available to the API key and the cloud-data acknowledgement remains enabled. The plugin can only use the fixed OpenAI API origin; do not attempt to redirect it through another remote endpoint.

## Structured Output Failure

The provider receives one repair attempt. If that also fails, inspect model compatibility and context limits, then re-run the scan. Do not paste raw prompt or note content into diagnostics.

## Apply/Re-index Mismatch

Leave the proposal in its recovery-required state. Re-index the affected vault files, compare the current revision with the approved proposal, and request a new approval if the source changed.

## Oversized Vault

Run the performance smoke gate, inspect the reported file and SQLite metrics, then reduce the scan scope or raise documented limits only after measuring a representative vault. Keep model requests serial and bounded.
