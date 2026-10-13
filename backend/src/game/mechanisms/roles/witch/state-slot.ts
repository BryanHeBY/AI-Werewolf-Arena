/**
 * 负责普通药剂族原生安装、同实例读取及每条药瓶／夜旗标写入。输入为原角色、捕获
 * 状态或受赠实例；输出保留原库存引用和部分失败前缀。夜复位先写两个使用旗标，再按
 * 自救规则短路读取日期；refresh 保持左侧捕获和右侧重复 state 读取。原生药瓶减量与受赠
 * postfix 毒药减量及其第二次 state 读取各有独立程序，不能合并；Demon 原生封存控制器／
 * writer 仍独立。JSON 复制不新增 payload 拒绝，prepared owner 只装原库存；生命、claim、次数
 * 与租约仍归原 caller，政策身份字节不变成档案编码、退款或行动许可。
 */
import type { WitchState, WitchReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import { WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../abilities";
import { commitPreparedNativeAbility } from "../prepared-native-install";

export function setWitchState(roleComp: RoleComponent, state: WitchState): WitchReadState {
  return commitPreparedNativeAbility(roleComp, "potion", WITCH_STATE_SLOT.create(state));
}

export function getWitchState(
  roleComp: RoleComponent,
  abilityId?: string,
): WitchReadState | undefined {
  return findNightAbility(roleComp, "potion", abilityId)?.state;
}

/** 两个复位写入及原规则判断之后才可能调用 currentDay；短路规则不多读日期。 */
export function resetWitchNightState(state: WitchReadState, currentDay: () => number): void {
  (state as WitchState).healUsedThisNight = false;
  (state as WitchState).poisonUsedThisNight = false;
  (state as WitchState).canSelfHeal =
    state.selfHealRule === WitchSelfHealRule.Always ||
    (state.selfHealRule === WitchSelfHealRule.FirstNightOnly && currentDay() === 1);
}

/** 保留左侧 state 捕获及右侧重复 state 读取；规则短路与写入时点不合并。 */
export function refreshWitchSelfHeal(
  ability: import("../abilities").NightAbilityReadView<"potion">,
  day: number,
): void {
  const state = ability.state;
  (state as WitchState).canSelfHeal =
    ability.state.selfHealRule === WitchSelfHealRule.Always ||
    (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
}

/** caller 在此写入前保持原 owner 当前性／来源检查；状态合法不替代该许可。 */
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

/** 受赠毒药保持 postfix 减量与第二次 state 读取，不能与原生药瓶付款合并。 */
export function consumeRecipientPoison(
  ability: import("../abilities").NightAbilityReadView<"potion">,
): void {
  (ability.state as WitchState).poison--;
  (ability.state as WitchState).poisonUsedThisNight = true;
}

/** 原 JSON callee 先于全部状态字段读取；只迁政策身份字节，不新增 payload snapshot 或失效租约。 */
function encodePolicyIdentity(ability: NightAbilityReadView<"potion">): string {
  return JSON.stringify([ability.state.selfHealRule,
    ability.state.knifeVisibility,
    ability.state.potionPolicy]);
}

/**
 * 本族完整契约引用原 JSON 复制函数和具体有序写入；create／schema 不改变旧接受集合。
 * install／get 与 caller 都消费同一实例库存，metadata 和 lease 保留唯一原所有者。
 * policyIdentity 是旧失效身份字节；checkpoint 归档并不调用新验证或改变原 privateState 形状。
 */
export const WITCH_STATE_SLOT = Object.freeze({
  create: copyAbilityData<WitchState>,
  schema: copyAbilityData<WitchState>,
  install: setWitchState,
  get: getWitchState,
  allowedWrites: Object.freeze({
    resetWitchNightState,
    refreshWitchSelfHeal,
    closeWitchPotionTurn,
    consumeWitchHeal,
    consumeWitchPoison,
    consumeRecipientPoison,
  }),
  checkpoint: Object.freeze({ policyIdentity: encodePolicyIdentity }),
  invalidations: Object.freeze({ policyIdentity: encodePolicyIdentity }),
});
