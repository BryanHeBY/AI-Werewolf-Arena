/**
 * 负责玩家回合归档的错误诊断字段白名单与结构读取。输入为未知诊断数据，输出为已校验
 * 的描述符值快照或精确字段校验错误；本契约只保存分类、状态码、重试信息和文件错误码。
 * 不序列化 Error、堆栈或供应商原始响应，不实施重试、读取文件或授予适配器运行权限。
 * 直接断言检查传入值，reader 先复制数据描述符再验证同一返回快照；二者边界不能混淆。
 */
import { assertField, isRecord } from "./validation";

/** 可归档诊断分类白名单；机器标识保持稳定，诊断事实不携带原始异常或供应商响应。 */
export const ERROR_DIAGNOSTIC_CODES = [
  "transport_error",
  "request_timeout",
  "request_aborted",
  "rate_limited",
  "authentication_failed",
  "permission_denied",
  "model_unavailable",
  "network_error",
  "filesystem_error",
  "action_failed",
] as const;
export type ErrorDiagnosticCode = (typeof ERROR_DIAGNOSTIC_CODES)[number];
export const FILE_ERROR_CODES = [
  "EACCES",
  "EPERM",
  "ENOENT",
  "ENOSPC",
  "EROFS",
  "EEXIST",
  "EMFILE",
  "ENFILE",
  "EIO",
] as const;
export interface ErrorDiagnostic {
  code: ErrorDiagnosticCode;
  statusCode?: number;
  retryable?: boolean;
  /** 记录已知等待建议，合法范围为零到一天；存在该字段不表示系统已经或必须重试。 */
  retryAfterMs?: number;
  fileCode?: (typeof FILE_ERROR_CODES)[number];
}
const diagnosticFields = ["code", "statusCode", "retryable", "retryAfterMs", "fileCode"] as const;
/** 只检查既有字段与范围，失败仍指向原精确路径；不把缺席字段补为默认重试政策。 */
export function assertErrorDiagnostic(
  value: unknown,
  path = "diagnostic",
): asserts value is ErrorDiagnostic {
  assertField(isRecord(value), path);
  assertField(
    typeof value.code === "string" &&
      ERROR_DIAGNOSTIC_CODES.includes(value.code as ErrorDiagnosticCode),
    `${path}.code`,
  );
  for (const key of Object.keys(value))
    assertField(
      diagnosticFields.includes(key as (typeof diagnosticFields)[number]),
      `${path}.${key}`,
    );
  assertField(
    value.statusCode === undefined ||
      (typeof value.statusCode === "number" &&
        Number.isInteger(value.statusCode) &&
        value.statusCode >= 100 &&
        value.statusCode <= 599),
    `${path}.statusCode`,
  );
  assertField(
    value.retryable === undefined || typeof value.retryable === "boolean",
    `${path}.retryable`,
  );
  assertField(
    value.retryAfterMs === undefined ||
      (typeof value.retryAfterMs === "number" &&
        Number.isSafeInteger(value.retryAfterMs) &&
        value.retryAfterMs >= 0 &&
        value.retryAfterMs <= 86_400_000),
    `${path}.retryAfterMs`,
  );
  assertField(
    value.fileCode === undefined ||
      (typeof value.fileCode === "string" &&
        FILE_ERROR_CODES.includes(value.fileCode as (typeof FILE_ERROR_CODES)[number])),
    `${path}.fileCode`,
  );
}

/** 按原数据描述符复制诊断元数据，再校验同一返回快照；不执行字段 getter。 */
export function readErrorDiagnostic(value: unknown): ErrorDiagnostic {
  assertField(isRecord(value), "diagnostic");
  const snapshot: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    assertField(
      diagnosticFields.includes(key as (typeof diagnosticFields)[number]) && "value" in descriptor,
      `diagnostic.${key}`,
    );
    snapshot[key] = descriptor.value;
  }
  assertErrorDiagnostic(snapshot);
  return snapshot;
}
