/**
 * 负责女巫原生槽读取及普通瓶数／夜旗标的具体写入。
 * 输入为角色和原生数据；输出保留实例安装复制与同一深只读引用。
 * 普通复位、结束 pass 和药瓶 payload 归此 feature，形状及可选政策归 contract。
 * caller 保留租约、印记、claim、use 与事实顺序；独立 verifier 和 Demon 封存库存不迁，
 * 本模块不产生状态镜像、资格重检、退款或检查点形状变化。
 */
import type { WitchState, WitchReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import { WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { findNightAbility } from "../abilities";
import { installNativeAbility } from "../ability_changes";

export function setWitchState(roleComp: RoleComponent, state: WitchState): WitchReadState {
  return installNativeAbility(roleComp, "potion", state);
}

export function getWitchState(
  roleComp: RoleComponent,
  abilityId?: string,
): WitchReadState | undefined {
  return findNightAbility(roleComp, "potion", abilityId)?.state;
}

/** Current-day callback is evaluated only after both reset writes and the original rule tests. */
export function resetWitchNightState(state: WitchReadState, currentDay: () => number): void {
  (state as WitchState).healUsedThisNight = false;
  (state as WitchState).poisonUsedThisNight = false;
  (state as WitchState).canSelfHeal =
    state.selfHealRule === WitchSelfHealRule.Always ||
    (state.selfHealRule === WitchSelfHealRule.FirstNightOnly && currentDay() === 1);
}

/** Preserve the original LHS state capture and repeated RHS state reads. */
export function refreshWitchSelfHeal(
  ability: import("../abilities").NightAbilityReadView<"potion">,
  day: number,
): void {
  const state = ability.state;
  (state as WitchState).canSelfHeal =
    ability.state.selfHealRule === WitchSelfHealRule.Always ||
    (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
}

/** Original owner-current/source checks run in the caller before this write. */
export function closeWitchPotionTurn(
  ability: import("../abilities").NightAbilityReadView<"potion">,
  day: number,
): void {
  (ability.state as WitchState).potionTurnClosedDay = day;
}

export function consumeWitchHeal(state: WitchReadState): void {
  (state as WitchState).heal -= 1;
  (state as WitchState).healUsedThisNight = true;
}

export function consumeWitchPoison(state: WitchReadState): void {
  (state as WitchState).poison -= 1;
  (state as WitchState).poisonUsedThisNight = true;
}

/** Keep recipient postfix decrement and its second state read distinct from native payment. */
export function consumeRecipientPoison(
  ability: import("../abilities").NightAbilityReadView<"potion">,
): void {
  (ability.state as WitchState).poison--;
  (ability.state as WitchState).poisonUsedThisNight = true;
}
