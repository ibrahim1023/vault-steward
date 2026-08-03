# Known Limitations

- The packaged `sql.js` runtime and migration smoke harness are verified in a temporary Obsidian-style fixture, but a final manual migration test in a running Obsidian desktop vault remains required for each supported Obsidian release line.
- Local model performance varies substantially by device and model; initial quality gates require calibration on representative synthetic and user-consented local fixtures.
- The current safe repair families cover validated internal-reference changes
  plus narrow existing-note task and decision fields. They do not draft or
  rewrite arbitrary note prose, create, delete, rename, or merge notes, or
  apply destructive rewrites.
- AI-ranked repair targets are suggestions from existing snapshot candidates,
  not assertions of correctness. The user still sees the exact result and must
  explicitly approve the prepared batch.
- A prepared batch is rejected as a whole when any member is stale, altered,
  conflicting, missing, or unauthorized. Runtime write failures use rollback
  and may require explicit recovery.
- Multi-vault operation, sync conflict resolution, encrypted-vault support, and future-extension agents are out of scope for the MVP.
- Marketplace readiness is not a release claim until the local-first Ollama
  evidence and final macOS acceptance pass. HyperFusion has a passing redacted
  synthetic-corpus report but remains validation-in-progress pending manual
  macOS acceptance. OpenAI remains experimental and unvalidated.
