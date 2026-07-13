export type DiagnosticInput = {
  correlationId: string;
  code: "provider-unavailable" | "scan-failed" | "apply-failed" | "migration-failed";
  cause?: string;
};

export type RedactedDiagnostic = {
  correlationId: string;
  code: DiagnosticInput["code"];
  message: string;
};

const MESSAGES: Record<DiagnosticInput["code"], string> = {
  "provider-unavailable": "The required local model provider is unavailable.",
  "scan-failed": "The scan could not complete.",
  "apply-failed": "The approved change could not be applied.",
  "migration-failed": "The local database migration could not complete."
};

export function createRedactedDiagnostic(input: DiagnosticInput): RedactedDiagnostic {
  if (!/^[a-z0-9-]{1,120}$/i.test(input.correlationId)) {
    throw new Error("diagnostic correlationId is invalid");
  }
  return { correlationId: input.correlationId, code: input.code, message: MESSAGES[input.code] };
}
