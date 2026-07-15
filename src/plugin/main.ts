import type { CoordinatorResult } from "../agents/coordinator.js";
import { runGovernedScan, type GovernedScanResult } from "../core/governed-scan.js";
import type { LocalProvider } from "../model-provider/local-provider.js";
import { checkReferenceIntegrity } from "../reference/check.js";
import { scanVaultFiles, type ScanSnapshot } from "../scanner/scan.js";
import type { VaultFile } from "../vault-adapter/types.js";

export type ReferenceIntegrityResult = {
  scanId: string;
  findings: Awaited<ReturnType<typeof runGovernedScan>>["findings"];
};

export type GovernedIntegrityResult = GovernedScanResult & { semanticAnalysis: CoordinatorResult };

export function createReferenceIntegritySession(): {
  scan(files: readonly VaultFile[]): ReferenceIntegrityResult;
} {
  return {
    scan(files) {
      const snapshot = scanVaultFiles(files);
      return { scanId: snapshot.id, findings: checkReferenceIntegrity(snapshot) };
    }
  };
}

export function createGovernedIntegritySession(providers: readonly LocalProvider[]): {
  scan(files: readonly VaultFile[], snapshot?: ScanSnapshot): Promise<GovernedIntegrityResult>;
} {
  return {
    async scan(files, snapshot) {
      const result = await runGovernedScan(files, providers, new Date().toISOString(), {
        ...(snapshot ? { snapshot } : {})
      });
      if (!result.completed)
        throw new Error("required local model semantic analysis did not complete");
      return result;
    }
  };
}
