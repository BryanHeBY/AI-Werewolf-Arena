/**
 * 负责读取死亡能力变更的现有展示事实。输入为事件名和已确认的惰性数据，输出经过原浅层字段及操作关联校验的记录或 null。
 * 未使用字段与 symbol 保持原接受面且不输出；能力 ID、时点和剩余次数只是事件元数据，不等于当前枪库存、待发提案或开枪许可。
 * 这里不递归复制或提交效果，反射的 Proxy trap／异常仍由调用方入口处理。
 */
export interface DeathAbilityEventFact {
  type: "death_ability_changed";
  actorId: number;
  abilityId: string;
  grantedNight: number;
  armedOnNight: number | null;
  remaining: 0 | 1;
  disabled: boolean;
  deathExpired: boolean;
  operation: "granted" | "armed" | "disabled" | "enabled" | "transferred_out";
}
// 只输出非 native: 前缀的能力变更字段；disabled／remaining／armedOnNight 的关联不等于实时可开枪。
export function readDeathAbilityEventFact(
  type: string,
  payload: unknown,
): DeathAbilityEventFact | null {
  if (type !== "death_ability_changed") return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return null;
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (
    !positive(p.actorId) ||
    typeof p.abilityId !== "string" ||
    !/^[a-z][a-z0-9:_-]{0,127}$/.test(p.abilityId) ||
    p.abilityId.startsWith("native:") ||
    !positive(p.grantedNight) ||
    !(p.armedOnNight === null || (positive(p.armedOnNight) && p.armedOnNight >= p.grantedNight)) ||
    ![0, 1].includes(p.remaining) ||
    typeof p.disabled !== "boolean" ||
    typeof p.deathExpired !== "boolean" ||
    !["granted", "armed", "disabled", "enabled", "transferred_out"].includes(p.operation)
  )
    return null;
  if (
    (p.operation === "armed" &&
      (p.armedOnNight === null || p.disabled || p.deathExpired || p.remaining !== 1)) ||
    (p.operation === "disabled" && !p.disabled) ||
    (p.operation === "enabled" && (p.disabled || p.deathExpired)) ||
    (p.deathExpired && (!p.disabled || p.remaining !== 0))
  )
    return null;
  return {
    type: "death_ability_changed",
    actorId: p.actorId,
    abilityId: p.abilityId,
    grantedNight: p.grantedNight,
    armedOnNight: p.armedOnNight,
    remaining: p.remaining,
    disabled: p.disabled,
    deathExpired: p.deathExpired,
    operation: p.operation,
  };
}
