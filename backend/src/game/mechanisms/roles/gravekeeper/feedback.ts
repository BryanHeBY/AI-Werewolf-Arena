/**
 * 负责在守墓人反馈阶段记录已提交的放逐结果。输入为接受的放逐结果及当前守墓人状态；输出为报告与事件。不公开未提交目标的身份或改变放逐结算。普通历史写入在原提交位置交给本地状态所有者；校验、使用记账和发布仍在此流程。
 */
import { recordExileFeedback } from "./state";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Role, type EntityId, type ExileFeedback } from "../../../../core/domain/model";
import { RoleCatalog } from "../catalog";
import { getDefaultRoleCatalog } from "../role-catalog-assembly";
import { resolveInspection } from "../inspection";
import { getGravekeeperState } from "./state";
import type { NightStageHandler } from "../../stages/night/contracts";

/** The manager calls this only after the voting hook confirms the main target's actual exile. */
export function captureExileFeedback(
  world: World,
  targetId: EntityId,
  exileDay: number,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): ExileFeedback | null {
  const result = resolveInspection(world, targetId, "camp", catalog);
  return result ? { exileDay, targetId, result: { ...result } } : null;
}

export const GRAVEKEEPER_FEEDBACK_STAGE: NightStageHandler = {
  id: "gravekeeper_feedback",
  priority: 550,
  async execute(ctx) {
    const fact = ctx.previousExile,
      receivedDay = ctx.currentDay();
    if (!ctx.isCurrent() || !fact || fact.exileDay !== receivedDay - 1) return;
    for (const actorId of ctx.getAliveByRole(Role.Gravekeeper)) {
      if (!ctx.isCurrent()) return;
      const role = ctx.world.getComponent(actorId, COMPONENT.Role);
      const state = role?.role === Role.Gravekeeper ? getGravekeeperState(role) : undefined;
      if (!state || state.history.some((report) => report.receivedDay === receivedDay)) continue;
      recordExileFeedback(state, fact, receivedDay);
      ctx.events.push({
        timestamp: Date.now(),
        type: "gravekeeper_reported",
        payload: { ...fact, actorId, receivedDay, result: { ...fact.result } },
      });
    }
  },
};
