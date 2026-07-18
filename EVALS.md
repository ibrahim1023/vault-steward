# Evaluation Methodology

Vault Steward keeps evaluations local and separates deterministic correctness checks from probabilistic model-quality measurement. Tests prove contracts, parsing, validation, policy behavior, state transitions, and apply safety. Evals measure candidate quality, evidence validity, latency, and resource use without using a user vault.

## Fixture Evaluations

Versioned fixture cases live in `evals/cases/` and are selected through manifests in `evals/manifests/`. Each case names an expected finding, relative evidence locator, severity, fix applicability, family, split, and contamination state. Development, CI, held-out, adversarial, and human-review data remain distinct.

Run the deterministic suites with `npm run eval:smoke` and `npm run eval:full`. Run the versioned fixture baseline gate with `npm run evals -- --manifest evals/manifests/ci-regression.json --compare evals/baselines/evaluation-main.json`.

## Replay And Comparison

Fixture replay reruns the same synthetic inputs and configuration into a redacted local record. A comparison is accepted only when fixture manifests match and exactly one declared field differs. Metadata-only live scans may be ineligible for exact replay because historical note source is not retained.

## Synthetic Scale Coverage

`npm run eval:synthetic` builds a disposable vault from a bounded seed and writes ignored artifacts under `evals/generated/` and `evals/reports/`. Its initial report measures deterministic reference findings against exact generated reference ground truth and rejects precision, recall, F1, configuration, or generated-file-count regressions against `evals/baselines/synthetic-scale.json`. Other generated defect labels are inputs for future family-specific evaluators, not reported as current model accuracy.

## Quality Reports

Model comparison, calibration, optional retrieval quality, and policy coverage reports are descriptive. They cannot select a default model, edit policies, authorize findings, or write notes. See `docs/evaluation-plan.md` for metrics and release thresholds.

`npm run eval:retrieval` writes a redacted retrieval-quality report. Without configured adapter metadata it reports `not-configured`; a local adapter may provide a bounded `events`/`expectations` JSON input under `evals/` for measurement.
