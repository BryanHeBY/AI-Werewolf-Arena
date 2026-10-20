/**
 * 公开守卫原生状态与普通目标写入，并拥有原重复目标查询。输入为原角色或已验证受赠实例；
 * 输出保留原只读状态引用、state 先于 target 的读取顺序。初始化 setter 仅装原生库存，
 * 普通查询／展示不授权、补发资源或创建 lease；caller 保留效果、次数与关闭失败的原前缀。
 */
export { getGuardState, recordGuardTarget, recordRecipientGuardTarget } from "./state-slot";

import type { NightAbilityReadView } from "../night-abilities/inventory-ports";

export function guardTargetRepeated(
  ability: NightAbilityReadView<"guard">,
  day: number,
  targetId: number,
): boolean {
  return (
    ability.state.lastTarget === targetId &&
    (ability.state.repeatPolicy !== "netease_consecutive_nights_v1" ||
      ability.lastUsedDay === day - 1)
  );
}

export { GUARD_STATE_SLOT } from "./state-slot";

export { setGuardState } from "./state-slot";
