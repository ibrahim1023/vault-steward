export function validateReleaseCompatibility(input: {
  manifestVersion: string;
  packageVersion: string;
  artifacts: readonly string[];
}): string[] {
  const required = [
    "main.js",
    "manifest.json",
    "sql-wasm.wasm",
    "styles.css",
    "release-manifest.json"
  ];
  return [
    ...(input.manifestVersion === input.packageVersion
      ? []
      : ["Manifest and package versions differ."]),
    ...required
      .filter((artifact) => !input.artifacts.includes(artifact))
      .map((artifact) => `Missing release artifact: ${artifact}`)
  ];
}
