export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class ReplayDocumentValidationError extends Error {
  constructor(
    readonly kind: "invalid_document" | "missing_fields" | "invalid_field" | "unsupported_version",
    readonly path: string,
  ) {
    super(`replay_document_invalid:${path}`);
    this.name = "ReplayDocumentValidationError";
  }
}

export function assertField(valid: boolean, path: string): asserts valid {
  if (!valid) throw new ReplayDocumentValidationError("invalid_field", path);
}


