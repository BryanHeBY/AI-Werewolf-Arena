import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Phase, Role, StatusMark } from "../../../domain/model";
import { safeRecordLogicOp } from "../../../session_recording";
import { NightStageHandler } from "../../stages/night/contracts";
import { getGuardState } from "../private_state";

const guardActionStage: NightStageHandler = {
  id: "guard_action",
  priority: 300,
  async execute(ctx): Promise<void> {
    for (const guardId of ctx.getAliveByRole(Role.Guard)) {
      const req = ctx.makeRequest(guardId, ["guard"], { phase: "guard" });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "guard") {
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, guardId, action, {
        phase: Phase.Night,
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
      const abstain = result.sanitizedCall.args.abstain === true;
      const targetId = result.sanitizedCall.args.target_id;
      if (!abstain && targetId !== null) {
        ctx.ensureMarks(targetId).add(StatusMark.GuardMark);
      }
      ctx.events.push({
        timestamp: Date.now(),
        type: "guard_applied",
        payload: { actorId: guardId, abstain, targetId },
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
      const guardState = role ? getGuardState(role) : undefined;
      if (guardState) {
        guardState.lastTarget = targetId;
      }
    }
  },
};

export const GUARD_NIGHT_STAGES: NightStageHandler[] = [guardActionStage];
