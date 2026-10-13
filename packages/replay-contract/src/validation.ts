/**
 * 负责复盘 reader 的纯数据描述符检查与结构化校验错误；输入为未知数据和精确字段路径。
 * 输出为原校验结果或错误；检查不解释规则、不补造历史身份、不包含 Node／浏览器运行权限。
 */
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

/** 在形状读取或 structuredClone 前拒绝非数据描述符，保持原反射与拒绝顺序。 */
export function assertSerializedData(value: object, path: string): void {
  const pending: object[] = [value],
    seen = new Set<object>();
  while (pending.length) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const prototype = Object.getPrototypeOf(current);
    assertField(
      Array.isArray(current)
        ? prototype === Array.prototype
        : prototype === Object.prototype || prototype === null,
      path,
    );
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
      assertField(
        typeof key === "string" &&
          "value" in descriptor &&
          (descriptor.enumerable === true || (Array.isArray(current) && key === "length")),
        path,
      );
      if (descriptor.value !== null && typeof descriptor.value === "object")
        pending.push(descriptor.value);
    }
  }
}
