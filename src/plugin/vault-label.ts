export function displayVaultName(
  activeVaultName: string | null | undefined,
  fallback: string
): string {
  const name = activeVaultName?.trim();
  return name || fallback;
}
