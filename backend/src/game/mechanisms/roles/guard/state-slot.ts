/**
 * 负责守卫普通／受赠能力的原生安装、同槽读取与上次目标字段写入。输入为原角色、
 * 状态或已验证受赠目标；输出保持 nullable lastTarget 和 repeatPolicy，不复制读到的库存。
 * 受赠写入先捕获左侧 ability.state，再读取 target.id getter；普通写入只修改已捕获字段，
 * 守护印记、映射目标、次数及事实发表仍由 caller 按原顺序负责。JSON 复制不扩大旧拒绝集合；
 * prepared owner 安装原库存，政策身份字节仅作既有失效检查，不新增 lease 或档案形状。
 */
import type { GuardState, GuardReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";

import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../abilities";
import { commitPreparedNativeAbility } from "../abilities";

export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardReadState {
  return commitPreparedNativeAbility(roleComp, "guard", GUARD_STATE_SLOT.create(state));
}

export function getGuardState(
  roleComp: RoleComponent,
  abilityId?: string,
): GuardReadState | undefined {
  return findNightAbility(roleComp, "guard", abilityId)?.state;
}

/** caller 保持原效果／发表和能力次数边界，此处只写捕获的目标字段。 */
export function recordGuardTarget(state: GuardReadState, targetId: EntityId | null): void {
  (state as { lastTarget: EntityId | null }).lastTarget = targetId;
}

/** 左侧先捕获原 state，再读取 target.id getter；后段失败仍保留原已提交前缀。 */
export function recordRecipientGuardTarget(
  ability: import("../abilities").NightAbilityReadView<"guard">,
  target: { readonly id: EntityId },
): void {
  const state = ability.state as { lastTarget: EntityId | null };
  state.lastTarget = target.id;
}

/** 原 JSON callee 先于全部状态字段读取；只迁政策身份字节，不新增 payload snapshot 或失效租约。 */
function encodePolicyIdentity(ability: NightAbilityReadView<"guard">): string {
  return JSON.stringify([ability.state.repeatPolicy]);
}

/**
 * 本族完整契约引用原 JSON 复制函数和具体有序写入；create／schema 不改变旧接受集合。
 * install／get 与 caller 都消费同一实例库存，metadata 和 lease 保留唯一原所有者。
 * policyIdentity 是旧失效身份字节；checkpoint 归档并不调用新验证或改变原 privateState 形状。
 */
export const GUARD_STATE_SLOT = Object.freeze({
  create: copyAbilityData<GuardState>,
  schema: copyAbilityData<GuardState>,
  install: setGuardState,
  get: getGuardState,
  allowedWrites: Object.freeze({
    recordGuardTarget,
    recordRecipientGuardTarget,
  }),
  checkpoint: Object.freeze({ policyIdentity: encodePolicyIdentity }),
  invalidations: Object.freeze({ policyIdentity: encodePolicyIdentity }),
});
