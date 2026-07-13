import type { Finding } from "../contracts/index.js";
import { LocalAgentCoordinator, type CoordinatorResult } from "../agents/coordinator.js";
import type { LocalProvider } from "../model-provider/local-provider.js";
import { checkReferenceIntegrity } from "../reference/check.js";
import { scanVaultFiles } from "../scanner/scan.js";
import type { VaultFile } from "../vault-adapter/types.js";

export type ReferenceIntegrityResult = {
  scanId: string;
  findings: Finding[];
};

export type GovernedIntegrityResult = ReferenceIntegrityResult & {
  semanticAnalysis: CoordinatorResult;
};

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
  scan(files: readonly VaultFile[]): Promise<GovernedIntegrityResult>;
} {
  const coordinator = new LocalAgentCoordinator(providers);
  return {
    async scan(files) {
      const snapshot = scanVaultFiles(files);
      const semanticAnalysis = await coordinator.run({
        scanId: snapshot.id,
        now: new Date().toISOString(),
        evidence: snapshot.notes.map((note) => ({
          notePath: note.path,
          locator: "line:1",
          excerpt: note.content.slice(0, 2_000)
        })),
        propositions: [],
        stalenessRecords: [],
        decisions: []
      });
      if (!semanticAnalysis.completed) {
        throw new Error("required local model semantic analysis did not complete");
      }
      return { scanId: snapshot.id, findings: checkReferenceIntegrity(snapshot), semanticAnalysis };
    }
  };
}
