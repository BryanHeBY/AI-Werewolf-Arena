/** 文件说明：守卫夜间阶段处理。 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, Role, StatusMark } from "../../../../core/domain/model";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { NightStageHandler } from "../../stages/night/contracts";
import { getGuardState } from "../private_state";
import { activeNightAbility, nightAbilityActors, recordNightAbilityUse } from "../abilities";

const guardActionStage: NightStageHandler = {
  id: "guard_action",
  priority: 300,
  async execute(ctx): Promise<void> {
    for (const { actorId: guardId, ability } of nightAbilityActors(ctx.world, "guard", ctx.currentDay())) {
      if (!ctx.world.getAliveEntityIds().includes(guardId) || activeNightAbility(ctx.world.getComponent<RoleComponent>(guardId, COMPONENT.Role), "guard", ctx.currentDay(), ability.id) !== ability) continue;
      const req = ctx.makeRequest(guardId, ["guard"], { stage: "guard", ability_id: ability.id });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "guard") {
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, guardId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(), abilityId: ability.id,
      });
      if (!result.ok || !result.sanitizedCall) {
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "guard_action_rejected",
          actorId: guardId,
          phase: Phase.Night,
          status: "rejected",
        });
        continue;
      }
      const currentRole = ctx.world.getComponent<RoleComponent>(guardId, COMPONENT.Role);
      if (!activeNightAbility(currentRole, "guard", ctx.currentDay(), ability.id)) continue;
      const abstain = result.sanitizedCall.args.abstain === true;
      const targetId = result.sanitizedCall.args.target_id;
      if (!abstain && targetId !== null) {
        ctx.ensureMarks(targetId).add(StatusMark.GuardMark);
      }
      ctx.events.push({
        timestamp: Date.now(),
        type: "guard_applied",
        payload: { actorId: guardId, ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }), abstain, targetId },
      });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "guard_applied",
        actorId: guardId,
        phase: Phase.Night,
        status: "ok",
        output: { abstain, target_id: targetId },
      });

      const role = ctx.world.getComponent<RoleComponent>(guardId, COMPONENT.Role);
      const guardState = role ? getGuardState(role, ability.id) : undefined;
      if (guardState) {
        guardState.lastTarget = targetId;
      }
      recordNightAbilityUse(ability, ctx.currentDay(), !abstain);
    }
  },
};

/** 守卫夜间阶段列表。 */
export const GUARD_NIGHT_STAGES: NightStageHandler[] = [guardActionStage];
