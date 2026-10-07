import { FILE_ERROR_CODES, type ErrorDiagnostic, type ErrorDiagnosticCode } from "@ai-werewolf-arena/replay-contract";
import { errorMessage, type Locale } from "@ai-werewolf-arena/game-text";

/** Read data fields without executing getters, toString, or toJSON on a foreign error. */
function own(value: unknown, field: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try { return Object.getOwnPropertyDescriptor(value, field)?.value; } catch { return undefined; }
}
const domNameGetter = Object.getOwnPropertyDescriptor(DOMException.prototype, "name")?.get;
function nativeExceptionName(value: unknown): unknown {
  try { return domNameGetter?.call(value); } catch { return undefined; }
}
const internalCodes: Readonly<Record<string, ErrorDiagnosticCode>> = Object.freeze({
  acp_deadline_elapsed: "request_timeout", acp_initialize_timeout: "request_timeout", audit_acp_timeout: "request_timeout",
  acp_initialization_timeout: "request_timeout", request_deadline_elapsed: "request_timeout",
  acp_initialization_aborted: "request_aborted", audit_acp_turn_closed: "request_aborted", audit_acp_executor_closed: "request_aborted",
  acp_session_closed: "request_aborted", acp_operation_aborted: "request_aborted",
  acp_provider_closed: "request_aborted", acp_session_discarded: "request_aborted",
});
const networkCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"]);

/** Bounded cause/lastError traversal handles SDK RetryError without copying its payload. */
export function describeError(error: unknown): ErrorDiagnostic {
  const seen = new Set<unknown>();
  let current = error;
  let best: ErrorDiagnostic = { code: "transport_error" };
  for (let depth = 0; depth < 8 && current && typeof current === "object" && !seen.has(current); depth++) {
    seen.add(current);
    const statusCode = own(current, "statusCode");
    const errno = own(current, "code");
    const name = nativeExceptionName(current) ?? own(current, "name");
    const message = own(current, "message");
    let code: ErrorDiagnosticCode = "transport_error";
    if (typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) {
      code = statusCode === 429 ? "rate_limited" : statusCode === 401 ? "authentication_failed"
        : statusCode === 403 ? "permission_denied" : statusCode === 408 || statusCode === 504 ? "request_timeout"
        : statusCode >= 500 ? "model_unavailable" : "transport_error";
    } else if (typeof errno === "string" && FILE_ERROR_CODES.includes(errno as typeof FILE_ERROR_CODES[number])) code = "filesystem_error";
    else if (typeof errno === "string" && networkCodes.has(errno)) code = "network_error";
    else if (errno === "ABORT_ERR" || name === "AbortError") code = "request_aborted";
    else if (name === "TimeoutError" || typeof message === "string" && /^llm_request_timeout_\d+ms$/.test(message)) code = "request_timeout";
    else if (typeof message === "string" && Object.hasOwn(internalCodes, message)) code = internalCodes[message];
    const candidate: ErrorDiagnostic = { code };
    if (typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) candidate.statusCode = statusCode;
    const retryable = own(current, "isRetryable");
    if (typeof retryable === "boolean") candidate.retryable = retryable;
    if (typeof errno === "string" && FILE_ERROR_CODES.includes(errno as typeof FILE_ERROR_CODES[number])) candidate.fileCode = errno as typeof FILE_ERROR_CODES[number];
    const seconds = own(own(current, "responseHeaders"), "retry-after");
    if (typeof seconds === "string" && /^\d{1,5}(?:\.\d{1,3})?$/.test(seconds)) {
      const [whole, fraction = ""] = seconds.split(".");
      const ms = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
      if (Number.isSafeInteger(ms) && ms <= 86_400_000) candidate.retryAfterMs = ms;
    }
    // A meaningful wrapper diagnosis is retained unless a deeper HTTP error supplies the facts.
    if (candidate.statusCode !== undefined || best.code === "transport_error" && code !== "transport_error") best = candidate;
    else if (best.code === "transport_error") best = candidate;
    current = own(current, "lastError") ?? own(current, "cause");
  }
  return best;
}
export function formatErrorDiagnostic(error: unknown, locale: Locale = "zh-CN"): string {
  const diagnostic = describeError(error);
  return JSON.stringify({ ...diagnostic, message: errorMessage(locale, diagnostic.code) });
}
