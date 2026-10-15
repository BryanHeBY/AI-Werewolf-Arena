/**
 * 负责维护协议消费者共享的准确语言标识。输入为未知值，输出 Locale 类型判定及原语言列表。
 * 这里只存语言 ID，不存可变的当前语言或显示字典；as const 不冻结数组，也不自动选择或回退语言。
 */
export const LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
