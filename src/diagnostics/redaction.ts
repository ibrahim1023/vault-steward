export type DiagnosticInput = {
  correlationId: string;
  code:
    | "provider-unavailable"
    | "structured-output-failed"
    | "scan-failed"
    | "apply-failed"
    | "migration-failed"
    | "index-rebuild-required"
    | "apply-reindex-mismatch"
    | "oversized-vault";
  cause?: string;
};

export type RedactedDiagnostic = {
  correlationId: string;
  code: DiagnosticInput["code"];
  message: string;
};

const MESSAGES: Record<DiagnosticInput["code"], string> = {
  "provider-unavailable": "The required local model provider is unavailable.",
  "structured-output-failed": "Local model output could not be validated.",
  "scan-failed": "The scan could not complete.",
  "apply-failed": "The approved change could not be applied.",
  "migration-failed": "The local database migration could not complete.",
  "index-rebuild-required": "The local index requires a rebuild.",
  "apply-reindex-mismatch": "The approved change completed but re-indexing needs recovery.",
  "oversized-vault": "The vault exceeds the configured processing limit."
};

export function createRedactedDiagnostic(input: DiagnosticInput): RedactedDiagnostic {
  if (!/^[a-z0-9-]{1,120}$/i.test(input.correlationId)) {
    throw new Error("diagnostic correlationId is invalid");
  }
  return { correlationId: input.correlationId, code: input.code, message: MESSAGES[input.code] };
}
