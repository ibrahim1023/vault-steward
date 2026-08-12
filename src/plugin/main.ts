import {
  AgentResultCache,
  LocalAgentCoordinator,
  type CoordinatorResult
} from "../agents/coordinator.js";
import { runGovernedScan, type GovernedScanResult } from "../core/governed-scan.js";
import type { ModelProvider } from "../model-provider/local-provider.js";
import { checkReferenceIntegrity } from "../reference/check.js";
import { scanVaultFiles, type ScanSnapshot } from "../scanner/scan.js";
import type { Policy } from "../policy/parse.js";
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

export function createGovernedIntegritySession(
  providers: readonly ModelProvider[],
  cache?: AgentResultCache
): {
  scan(
    files: readonly VaultFile[],
    snapshot?: ScanSnapshot,
    policies?: readonly Policy[]
  ): Promise<GovernedIntegrityResult>;
} {
  return {
    async scan(files, snapshot, policies) {
      const result = await runGovernedScan(files, providers, new Date().toISOString(), {
        ...(snapshot ? { snapshot } : {}),
        ...(policies ? { policies } : {}),
        ...(cache ? { coordinator: new LocalAgentCoordinator(providers, cache) } : {})
      });
      if (!result.completed) {
        if (result.limitations.includes("local-model-output-unavailable")) {
          throw new Error("required model output could not be validated");
        }
        throw new Error("required model provider is unavailable");
      }
      return result;
    }
  };
}
