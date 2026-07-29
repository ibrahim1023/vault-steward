# Known Limitations

- The packaged `sql.js` runtime and migration smoke harness are verified in a temporary Obsidian-style fixture, but a final manual migration test in a running Obsidian desktop vault remains required for each supported Obsidian release line.
- Local model performance varies substantially by device and model; initial quality gates require calibration on representative synthetic and user-consented local fixtures.
- The current safe repair family is limited to validated internal-reference
  replacements. Vault Steward does not draft semantic note text or apply
  destructive rename/delete rewrites.
- AI-ranked repair targets are suggestions from existing snapshot candidates,
  not assertions of correctness. The user still sees the exact result and must
  explicitly approve the prepared batch.
- A prepared batch is rejected as a whole when any member is stale, altered,
  conflicting, missing, or unauthorized. Runtime write failures use rollback
  and may require explicit recovery.
- Multi-vault operation, sync conflict resolution, encrypted-vault support, and future-extension agents are out of scope for the MVP.
- Marketplace provider support is not a release claim until the same committed
  Northstar corpus has passing Ollama and OpenAI reports. The harness exists,
  but live provider results and the macOS acceptance sign-off remain pending.
