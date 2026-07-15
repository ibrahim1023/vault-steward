import {
  createRedactedDiagnostic,
  type DiagnosticInput,
  type RedactedDiagnostic
} from "./redaction.js";

export class DiagnosticRegistry {
  private readonly diagnostics: RedactedDiagnostic[] = [];

  constructor(private readonly capacity = 100) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new Error("diagnostic capacity is invalid");
  }

  record(input: DiagnosticInput): RedactedDiagnostic {
    const diagnostic = createRedactedDiagnostic(input);
    this.diagnostics.push(diagnostic);
    if (this.diagnostics.length > this.capacity)
      this.diagnostics.splice(0, this.diagnostics.length - this.capacity);
    return diagnostic;
  }

  list(): readonly RedactedDiagnostic[] {
    return [...this.diagnostics];
  }

  summary(): Partial<Record<DiagnosticInput["code"], number>> {
    return this.diagnostics.reduce<Partial<Record<DiagnosticInput["code"], number>>>(
      (counts, diagnostic) => ({
        ...counts,
        [diagnostic.code]: (counts[diagnostic.code] ?? 0) + 1
      }),
      {}
    );
  }
}
