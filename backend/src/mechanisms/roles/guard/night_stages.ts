import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Phase, Role, StatusMark } from "../../../domain/model";
import { safeRecordLogicOp } from "../../../session_recording";
import { NightStageHandler } from "../../stages/night/contracts";

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
      if (result.sanitizedCall.args.abstain || result.sanitizedCall.args.target_id === null) {
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      ctx.ensureMarks(targetId).add(StatusMark.GuardMark);
      ctx.events.push({
        timestamp: Date.now(),
        type: "guard_applied",
        payload: { actorId: guardId, targetId },
      });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "guard_applied",
        actorId: guardId,
        phase: Phase.Night,
        status: "ok",
        output: { target_id: targetId },
      });

      const role = ctx.world.getComponent<RoleComponent>(guardId, COMPONENT.Role);
      if (role?.guardState) {
        role.guardState.lastTarget = targetId;
      }
    }
  },
};

export const GUARD_NIGHT_STAGES: NightStageHandler[] = [guardActionStage];

