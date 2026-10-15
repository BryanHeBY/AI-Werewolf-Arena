/**
 * 负责玩家状态投影的自有字段读取、正整数判别与数组数据项收集。输入为未知数据；
 * 输出为原字段值、判别结果或收集数组，不查询角色、World、语言或运行权限。
 * 字段读取排除访问器；数组收集保原 length 读取与逐项描述符顺序，不为任意 Proxy 保证零 trap。
 * 本模块没有运行状态或副作用依赖，不安装库存、克隆整个私有容器或负责归档校验。
 */
/** 只读声明的自有数据字段；保留原 Array 拒绝、descriptor 与 hasOwn 判断顺序。 */
export function playerDataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && Object.hasOwn(field, "value") ? field.value : undefined;
}

/** 只判别有限正整数，不将字符串或小数规范化为玩家编号。 */
export function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** 按原索引顺序收集存在的数据项；跳过孔洞和访问器，保留原数组 length 的逐轮读取。 */
export function rows(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (field && Object.hasOwn(field, "value")) result.push(field.value);
  }
  return result;
}
