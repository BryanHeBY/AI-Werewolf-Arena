/**
 * 负责将外来错误整理为有限的展示诊断。输入为 unknown 错误和可选展示语言，输出诊断数据或本地化 JSON 文本。
 * 只提取白名单字段；不复制原错误正文、请求负载或完整响应头，也不决定重试和游戏回退。
 */
import {
  FILE_ERROR_CODES,
  type ErrorDiagnostic,
  type ErrorDiagnosticCode,
} from "@ai-werewolf-arena/replay-contract";
import { errorMessage, type Locale } from "@ai-werewolf-arena/game-text";

/**
 * 只读取自有数据描述符的 value，不调用字段访问器、toString 或 toJSON。
 * Proxy 的描述符 trap 仍可执行；这里只捕获其异常，不承诺任意外来对象读取无副作用。
 */
function own(value: unknown, field: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    return Object.getOwnPropertyDescriptor(value, field)?.value;
  } catch {
    return undefined;
  }
}
// 捕获原生 DOMException 的 name 读取器；品牌不匹配时失败，由调用方回退到自有 name 数据。
const domNameGetter = Object.getOwnPropertyDescriptor(DOMException.prototype, "name")?.get;
function nativeExceptionName(value: unknown): unknown {
  try {
    return domNameGetter?.call(value);
  } catch {
    return undefined;
  }
}
// 现有运行错误文字映射为稳定诊断码；原 message 只用于匹配，不进入输出数据。
const internalCodes: Readonly<Record<string, ErrorDiagnosticCode>> = Object.freeze({
  action_turn_failed: "action_failed",
  turn_invalid_action_limit: "action_failed",
  acp_deadline_elapsed: "request_timeout",
  acp_initialize_timeout: "request_timeout",
  audit_acp_timeout: "request_timeout",
  acp_initialization_timeout: "request_timeout",
  request_deadline_elapsed: "request_timeout",
  action_request_delivery_expired: "request_timeout",
  action_request_delivery_authority_revoked: "action_failed",
  acp_initialization_aborted: "request_aborted",
  audit_acp_turn_closed: "request_aborted",
  audit_acp_executor_closed: "request_aborted",
  acp_session_closed: "request_aborted",
  acp_operation_aborted: "request_aborted",
  acp_provider_closed: "request_aborted",
  acp_session_discarded: "request_aborted",
});
// 网络 errno 的白名单与文件 errno 分开判断；集合不扩展错误的接受或重试策略。
const networkCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** 最多查看八层，遇已见对象立即停止链式读取；按 lastError 优先于 cause 的现有顺序穿透 SDK 错误包装。 */
export function describeError(error: unknown): ErrorDiagnostic {
  const seen = new Set<unknown>();
  let current = error;
  let best: ErrorDiagnostic = { code: "transport_error" };
  for (
    let depth = 0;
    depth < 8 && current && typeof current === "object" && !seen.has(current);
    depth++
  ) {
    seen.add(current);
    const statusCode = own(current, "statusCode");
    const errno = own(current, "code");
    const name = nativeExceptionName(current) ?? own(current, "name");
    const message = own(current, "message");
    let code: ErrorDiagnosticCode = "transport_error";
    // 有效 HTTP 整数状态优先于 errno、名称和内部 message；随后分支保持原短路顺序。
    if (
      typeof statusCode === "number" &&
      Number.isInteger(statusCode) &&
      statusCode >= 100 &&
      statusCode <= 599
    ) {
      code =
        statusCode === 429
          ? "rate_limited"
          : statusCode === 401
            ? "authentication_failed"
            : statusCode === 403
              ? "permission_denied"
              : statusCode === 408 || statusCode === 504
                ? "request_timeout"
                : statusCode >= 500
                  ? "model_unavailable"
                  : "transport_error";
    } else if (
      typeof errno === "string" &&
      FILE_ERROR_CODES.includes(errno as (typeof FILE_ERROR_CODES)[number])
    )
      code = "filesystem_error";
    else if (typeof errno === "string" && networkCodes.has(errno)) code = "network_error";
    else if (errno === "ABORT_ERR" || name === "AbortError") code = "request_aborted";
    else if (
      name === "TimeoutError" ||
      (typeof message === "string" && /^llm_request_timeout_\d+ms$/.test(message))
    )
      code = "request_timeout";
    else if (typeof errno === "string" && Object.hasOwn(internalCodes, errno))
      code = internalCodes[errno];
    else if (typeof message === "string" && Object.hasOwn(internalCodes, message))
      code = internalCodes[message];
    // 每层独立构造白名单候选；retryable 只是诊断资料，不在这里触发网络重试。
    const candidate: ErrorDiagnostic = { code };
    if (
      typeof statusCode === "number" &&
      Number.isInteger(statusCode) &&
      statusCode >= 100 &&
      statusCode <= 599
    )
      candidate.statusCode = statusCode;
    const retryable = own(current, "isRetryable");
    if (typeof retryable === "boolean") candidate.retryable = retryable;
    if (
      typeof errno === "string" &&
      FILE_ERROR_CODES.includes(errno as (typeof FILE_ERROR_CODES)[number])
    )
      candidate.fileCode = errno as (typeof FILE_ERROR_CODES)[number];
    // Retry-After 仅接受当前十进制秒格式并转换为至多一天的毫秒数；不解析 HTTP 日期。
    const seconds = own(own(current, "responseHeaders"), "retry-after");
    if (typeof seconds === "string" && /^\d{1,5}(?:\.\d{1,3})?$/.test(seconds)) {
      const [whole, fraction = ""] = seconds.split(".");
      const ms = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
      if (Number.isSafeInteger(ms) && ms <= 86_400_000) candidate.retryAfterMs = ms;
    }
    // 任一后续有效 HTTP 状态会替换既有候选；无 HTTP 时，仅通用 transport_error 可被后续候选替换。
    if (
      candidate.statusCode !== undefined ||
      (best.code === "transport_error" && code !== "transport_error")
    )
      best = candidate;
    else if (best.code === "transport_error") best = candidate;
    // 非 null/undefined 的 lastError 总是优先；若它是原始值，下轮停止，不另行尝试 cause。
    current = own(current, "lastError") ?? own(current, "cause");
  }
  return best;
}
/** 输出稳定诊断码与指定语言的说明；message 来自词典，不使用原错误的任意正文。 */
export function formatErrorDiagnostic(error: unknown, locale: Locale = "zh-CN"): string {
  const diagnostic = describeError(error);
  return JSON.stringify({ ...diagnostic, message: errorMessage(locale, diagnostic.code) });
}
