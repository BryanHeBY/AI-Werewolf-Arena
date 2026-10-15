/**
 * 负责预言家原生／受赠查验状态的创建、同实例读取与实际报告写入。输入为原角色、
 * 捕获状态及已验证目标／阵营结果；输出保留 lastTarget、lastIsWerewolf、lastResult 与历史
 * 的原有序写入。普通查验消费捕获 state，受赠查验分别读取四次 ability.state 和两次 target.id，
 * 不能缓存或合并为一次写入。JSON 复制不新增 payload 形状校验，native 库存安装归 prepared owner；
 * 目标、次数、生命与请求资格仍归原 caller／lease，政策身份字节不替代档案编码或新授权。
 */
import type { SeerState, SeerReadState } from "@ai-werewolf-arena/game-contract";

import type { EntityId, InspectionResult } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../domain/components/role";
import { copyAbilityData, findNightAbility, type NightAbilityReadView } from "../abilities";
import { commitPreparedNativeAbility } from "../abilities";

/** 安装保留原输入复制与返回 owned 引用；只在初始化入口写原生库存。 */
export function setSeerState(roleComp: RoleComponent, state: SeerState): SeerReadState {
  return commitPreparedNativeAbility(roleComp, "seer_check", SEER_STATE_SLOT.create(state));
}

/** 原生优先选择不按活跃／耗尽过滤；读取不创建或补充资源。 */
export function getSeerState(
  roleComp: RoleComponent,
  abilityId?: string,
): SeerReadState | undefined {
  return findNightAbility(roleComp, "seer_check", abilityId)?.state;
}

/** caller 仍拥有目标／scope 检查及写前、写后的效果；部分失败不回滚前缀。 */
export function recordSeerInspection(
  state: SeerReadState,
  targetId: EntityId,
  isWerewolf: boolean,
  inspection: InspectionResult,
): void {
  (state as SeerState).lastTarget = targetId;
  (state as SeerState).lastIsWerewolf = isWerewolf;
  (state as SeerState).lastResult = { ...inspection };
  (state as SeerState).history.push({ targetId, isWerewolf, result: { ...inspection } });
}

/** 受赠查验保留每次写入前的 state 读取，以及原两次 target.id 读取，不缓存它们。 */
export function recordRecipientSeerInspection(
  ability: NightAbilityReadView<"seer_check">,
  target: { readonly id: EntityId },
  isWerewolf: boolean,
  result: InspectionResult,
): void {
  (ability.state as SeerState).lastTarget = target.id;
  (ability.state as SeerState).lastIsWerewolf = isWerewolf;
  (ability.state as SeerState).lastResult = { ...result };
  (ability.state as SeerState).history.push({
    targetId: target.id,
    isWerewolf,
    result: { ...result },
  });
}

/** 原 JSON callee 先于全部状态字段读取；只迁政策身份字节，不新增 payload snapshot 或失效租约。 */
function encodePolicyIdentity(ability: NightAbilityReadView<"seer_check">): string {
  return JSON.stringify([ability.state.targetPolicy, ability.state.actionPolicy]);
}

/**
 * 本族完整契约引用原 JSON 复制函数和具体有序写入；create／schema 不改变旧接受集合。
 * install／get 与 caller 都消费同一实例库存，metadata 和 lease 保留唯一原所有者。
 * policyIdentity 是旧失效身份字节；checkpoint 归档并不调用新验证或改变原 privateState 形状。
 */
export const SEER_STATE_SLOT = Object.freeze({
  create: copyAbilityData<SeerState>,
  schema: copyAbilityData<SeerState>,
  install: setSeerState,
  get: getSeerState,
  allowedWrites: Object.freeze({
    recordSeerInspection,
    recordRecipientSeerInspection,
  }),
  checkpoint: Object.freeze({ policyIdentity: encodePolicyIdentity }),
  invalidations: Object.freeze({ policyIdentity: encodePolicyIdentity }),
});
