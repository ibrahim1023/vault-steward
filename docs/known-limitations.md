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
- macOS is the validated desktop platform; Windows and Linux remain
  unvalidated.
- Marketplace readiness is not a release claim. The remaining release-owner
  actions are public-repository/license confirmation, version/tag/changelog
  alignment, current screenshots, a scan-to-approval demonstration, the final
  release-quality **go** decision, a security-assurance risk disposition for
  unvalidated persisted-finding hydration (or its remediation and focused
  regression coverage), and the separate upstream submission.
