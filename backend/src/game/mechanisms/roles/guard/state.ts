/**
 * 负责守卫原生槽读取和具体 lastTarget 写入。
 * 输入为角色与原生数据；输出保留实例 owner 的安装复制及同一深只读状态引用。
 * 普通原生／受赠 lastTarget 命令归此 leaf，repeatPolicy 与 nullable 目标形状来自 contract。
 * caller 保留效果／事实／次数顺序；Demon 封存第三 writer 独立，不产生镜像、退款或新检查点字段。
 */
import type { GuardState, GuardReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";

import { findNightAbility } from "../abilities";
import { installNativeAbility } from "../ability_changes";

export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardReadState {
  return installNativeAbility(roleComp, "guard", state);
}

export function getGuardState(
  roleComp: RoleComponent,
  abilityId?: string,
): GuardReadState | undefined {
  return findNightAbility(roleComp, "guard", abilityId)?.state;
}

/** The caller retains its original effect/publication and ability-use boundaries. */
export function recordGuardTarget(state: GuardReadState, targetId: EntityId | null): void {
  (state as { lastTarget: EntityId | null }).lastTarget = targetId;
}

/** Preserve captured LHS state before evaluating the original target ID getter. */
export function recordRecipientGuardTarget(
  ability: import("../abilities").NightAbilityReadView<"guard">,
  target: { readonly id: EntityId },
): void {
  const state = ability.state as { lastTarget: EntityId | null };
  state.lastTarget = target.id;
}
