import type { Finding } from "../contracts/index.js";
import { checkReferenceIntegrity } from "../reference/check.js";
import { scanVaultFiles } from "../scanner/scan.js";
import type { VaultFile } from "../vault-adapter/types.js";

export type ReferenceIntegrityResult = {
  scanId: string;
  findings: Finding[];
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
