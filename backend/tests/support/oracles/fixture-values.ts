/**
 * 提供两个测试输入窄读取 helper：fixtureNumber 只接受有限 number 并返回原值；fixtureObject 排除 null、非 object 和数组后返回原对象引用。不深校验字段、不复制或冻结，不另作 Proxy 准入判断；原生判定异常直接外抛，不生成库存、身份或游戏结果预期。
 */


export function fixtureNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("fixture_number_invalid");
  return value;
}

export function fixtureObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("fixture_object_invalid");
  return value as Record<string, unknown>;
}
