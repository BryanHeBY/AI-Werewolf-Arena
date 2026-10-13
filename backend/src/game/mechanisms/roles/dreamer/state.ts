/**
 * 负责梦摄原生状态槽访问及 target/day/history 的具体写入。
 * 输入为原角色、能力或已捕获状态和接受目标；输出保留安装复制、原槽引用与部分写入顺序。
 * 数据／只读形状来自 contract；连续目标、租约、use 计数、梦效果和事实仍在原 caller 位置。
 * 本 owner 不制造状态镜像、回滚已付资源或新增资格重检。
 */
import type { DreamerState, DreamerReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import { findNightAbility } from "../abilities";
import { installNativeAbility } from "../ability_changes";

export function setDreamerState(roleComp: RoleComponent, state: DreamerState): DreamerReadState {
  return installNativeAbility(roleComp, "dream", state);
}

export function getDreamerState(
  roleComp: RoleComponent,
  abilityId?: string,
): DreamerReadState | undefined {
  return findNightAbility(roleComp, "dream", abilityId)?.state;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordDreamSelection(
  state: DreamerReadState,
  targetId: EntityId,
  day: number,
): void {
  (state as DreamerState).lastTarget = targetId;
  (state as DreamerState).lastDay = day;
  (state as DreamerState).history.push({ day, targetId });
}
