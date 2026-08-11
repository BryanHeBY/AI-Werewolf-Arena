/** 文件说明：LLM 参数纠正流程共用工具函数。 */

/** 将任意输入安全转换为 number 或 null。 */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
