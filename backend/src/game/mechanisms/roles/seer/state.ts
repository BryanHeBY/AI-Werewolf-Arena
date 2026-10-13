/**
 * 负责预言家实际能力槽的只读访问与普通查验具体写入。
 * 输入为选定能力或已捕获状态引用；输出为同一深只读存储状态及有序 last-result/history 写入。
 * 安装复制、实例 metadata 与退休归共享 owner；trusted 命令只局部恢复实际字段写权。
 * 不授予行动资格、切换阶段或回滚部分写入，Demon 封存提交仍是独立 writer。
 */
import type { SeerState, SeerReadState } from "@ai-werewolf-arena/game-contract";

import type { EntityId, InspectionResult } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { findNightAbility, type NightAbilityReadView } from "../abilities";
import { installNativeAbility } from "../ability_changes";

/** Installation retains the ability owner's input copy and returned owned reference. */
export function setSeerState(roleComp: RoleComponent, state: SeerState): SeerReadState {
  return installNativeAbility(roleComp, "seer_check", state);
}

/** Reads retain native-first selection and do not filter inactive or spent instances. */
export function getSeerState(
  roleComp: RoleComponent,
  abilityId?: string,
): SeerReadState | undefined {
  return findNightAbility(roleComp, "seer_check", abilityId)?.state;
}

/** The caller owns target/scope checks and all effects before and after this write prefix. */
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

/** Recipient reads retain their original per-write ability state and target ID accesses. */
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
