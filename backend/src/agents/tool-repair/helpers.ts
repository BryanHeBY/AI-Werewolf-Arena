/**
 * 负责参数修复的有限数值转换；输入任意值，输出有限 number 或 null。
 * 仅 null／undefined 直接返回 null，其它值走原 Number 转换；不校验整数、玩家编号或目标资格。
 * 转换可能执行调用方的原始值转换逻辑并抛错，本函数不捕获或改写该异常。
 */

/** 空串、布尔和可转换对象仍沿 Number 的原接受面；NaN／无穷转为 null，转换抛错保原错误。 */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
