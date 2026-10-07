import { assertField, isRecord } from "./validation";

/** Diagnostic facts are a whitelist, never a serialized Error or provider response. */
export const ERROR_DIAGNOSTIC_CODES = [
  "transport_error", "request_timeout", "request_aborted", "rate_limited", "authentication_failed",
  "permission_denied", "model_unavailable", "network_error", "filesystem_error",
] as const;
export type ErrorDiagnosticCode = typeof ERROR_DIAGNOSTIC_CODES[number];
export const FILE_ERROR_CODES = ["EACCES", "EPERM", "ENOENT", "ENOSPC", "EROFS", "EEXIST", "EMFILE", "ENFILE", "EIO"] as const;
export interface ErrorDiagnostic {
  code: ErrorDiagnosticCode;
  statusCode?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  fileCode?: typeof FILE_ERROR_CODES[number];
}
const diagnosticFields = ["code", "statusCode", "retryable", "retryAfterMs", "fileCode"] as const;
export function assertErrorDiagnostic(value: unknown, path = "diagnostic"): asserts value is ErrorDiagnostic {
  assertField(isRecord(value), path);
  assertField(typeof value.code === "string" && ERROR_DIAGNOSTIC_CODES.includes(value.code as ErrorDiagnosticCode), `${path}.code`);
  for (const key of Object.keys(value)) assertField(diagnosticFields.includes(key as typeof diagnosticFields[number]), `${path}.${key}`);
  assertField(value.statusCode === undefined || typeof value.statusCode === "number" && Number.isInteger(value.statusCode) && value.statusCode >= 100 && value.statusCode <= 599, `${path}.statusCode`);
  assertField(value.retryable === undefined || typeof value.retryable === "boolean", `${path}.retryable`);
  assertField(value.retryAfterMs === undefined || typeof value.retryAfterMs === "number" && Number.isSafeInteger(value.retryAfterMs) && value.retryAfterMs >= 0 && value.retryAfterMs <= 86_400_000, `${path}.retryAfterMs`);
  assertField(value.fileCode === undefined || typeof value.fileCode === "string" && FILE_ERROR_CODES.includes(value.fileCode as typeof FILE_ERROR_CODES[number]), `${path}.fileCode`);
}

/** Unknown metadata is copied from data descriptors; validate the exact returned snapshot. */
export function readErrorDiagnostic(value: unknown): ErrorDiagnostic {
  assertField(isRecord(value), "diagnostic");
  const snapshot: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    assertField(diagnosticFields.includes(key as typeof diagnosticFields[number]) && "value" in descriptor, `diagnostic.${key}`);
    snapshot[key] = descriptor.value;
  }
  assertErrorDiagnostic(snapshot);
  return snapshot;
}
