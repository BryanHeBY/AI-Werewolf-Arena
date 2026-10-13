/**
 * 负责复盘 reader 的纯数据描述符检查与结构化校验错误；输入为未知数据和精确字段路径。
 * 输出为原校验结果或错误；检查不解释规则、不补造历史身份、不包含 Node／浏览器运行权限。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  // 这里只排除 null 和数组；原型、访问器及可序列化形状需由具体 reader 或下方检查另行核对。
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class ReplayDocumentValidationError extends Error {
  /** kind 区分错误类别，path 关联原字段；message 保持旧机器前缀，不拼接输入原文。 */
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
  // seen 避免共享引用或循环对象被反复遍历；这一步不宣称整个输入能被 JSON.stringify 编码。
  while (pending.length) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const prototype = Object.getPrototypeOf(current);
    // 只接收原普通／空原型对象及普通数组；反射本身仍可能触发 Proxy trap，不是 Node 对象准入。
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
      // 原数组 length 可不枚举，其他字段必须是可枚举数据属性；所有嵌套对象都继续入栈检查。
      if (descriptor.value !== null && typeof descriptor.value === "object")
        pending.push(descriptor.value);
    }
  }
}
