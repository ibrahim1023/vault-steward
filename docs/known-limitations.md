# Known Limitations

- SQLite availability and migration packaging inside Obsidian desktop must be validated before committing to a concrete library.
- Local model performance varies substantially by device and model; initial quality gates require calibration on representative synthetic and user-consented local fixtures.
- Safe patch semantics for Markdown/frontmatter require a dedicated contract before any mutation feature is built.
- Multi-vault operation, sync conflict resolution, encrypted-vault support, and future-extension agents are out of scope for the first vertical slice.
- The first vertical slice is read-only and uses an in-memory session; it does not yet persist scans or integrate with Obsidian's runtime APIs.
