/**
 * 负责角色查验原生状态访问和有序的角色报告历史写入。
 * 输入为原角色／能力或捕获状态、目标、日期与角色标签；输出保留复制后的安装状态和同槽只读引用。
 * 数据形状归 contract，具体历史写入归本 leaf；caller 仍拥有目标验证、次数与事实发布。
 * 不增加租约检查、退款、生命周期推进或归档政策。
 */
import type {
  RoleInspectionState,
  RoleInspectionReadState,
} from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { InspectionResult } from "@ai-werewolf-arena/game-contract";
import { findNightAbility } from "../abilities";
import { installNativeAbility } from "../ability_changes";

export function setRoleInspectionState(
  role: RoleComponent,
  state: RoleInspectionState,
): RoleInspectionReadState {
  return installNativeAbility(role, "role_check", state);
}

export function getRoleInspectionState(
  role: RoleComponent,
  abilityId?: string,
): RoleInspectionReadState | undefined {
  return findNightAbility(role, "role_check", abilityId)?.state;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordRoleInspection(
  state: RoleInspectionReadState,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (state as RoleInspectionState).lastTarget = targetId;
  (state as RoleInspectionState).lastDay = day;
  (state as RoleInspectionState).history.push({ day, targetId, result: { ...result } });
}

/** Preserve Pure White's three original state reads and exactly one result-history append. */
export function recordAbilityRoleInspection(
  ability: import("../abilities").NightAbilityReadView<"role_check">,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (ability.state as RoleInspectionState).lastTarget = targetId;
  (ability.state as RoleInspectionState).lastDay = day;
  (ability.state as RoleInspectionState).history.push({ day, targetId, result: { ...result } });
}
