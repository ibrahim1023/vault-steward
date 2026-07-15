# Known Limitations

- The packaged `sql.js` runtime and migration smoke harness are verified in a temporary Obsidian-style fixture, but a final manual migration test in a running Obsidian desktop vault remains required for each supported Obsidian release line.
- Local model performance varies substantially by device and model; initial quality gates require calibration on representative synthetic and user-consented local fixtures.
- Safe Markdown patch contracts, explicit approval, stale-revision checks, audit records, and post-write re-index hooks exist in the core workflow. Their proposal-review controls are not yet connected to the live Obsidian workspace.
- The live workspace exposes deterministic reference findings only. Entity, contradiction, staleness, and decision candidates are run through the required local-model coordinator but are not yet translated into persisted findings or shown in the review queue.
- Multi-vault operation, sync conflict resolution, encrypted-vault support, and future-extension agents are out of scope for the MVP.
