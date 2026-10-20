/**
 * 负责运行配置的结构化字段诊断，输入固定错误码与字段路径，输出保留原 message 的异常。
 * 本类型拥有诊断数据，不保存字段原值、认证或解析环境；消费者可以安全定位表单，不能据此执行游戏。
 */
export class RuntimeConfigFieldError extends Error {
  constructor(
    readonly code: string,
    readonly fieldPath: string,
  ) {
    super(`${code}: ${fieldPath}`);
  }
}
