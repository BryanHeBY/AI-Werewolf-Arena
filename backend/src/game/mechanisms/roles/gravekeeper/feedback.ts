import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Role, type EntityId, type ExileFeedback } from "../../../../core/domain/model";
import { RoleCatalog, getDefaultRoleCatalog } from "../catalog";
import { resolveInspection } from "../inspection";
import { getGravekeeperState } from "../private_state";
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
      const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
      const state = role?.role === Role.Gravekeeper ? getGravekeeperState(role) : undefined;
      if (!state || state.history.some((report) => report.receivedDay === receivedDay)) continue;
      state.history.push({ ...fact, receivedDay, result: { ...fact.result } });
      ctx.events.push({
        timestamp: Date.now(),
        type: "gravekeeper_reported",
        payload: { ...fact, actorId, receivedDay, result: { ...fact.result } },
      });
    }
  },
};
