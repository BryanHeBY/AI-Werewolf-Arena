/** 文件说明：预言家夜间查验阶段处理。 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState } from "../private_state";
import { resolveInspection } from "../inspection";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    for (const seerId of ctx.getAliveByRole(Role.Seer)) {
      const req = ctx.makeRequest(seerId, ["check_identity"], {
        stage: "seer",
      });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "check_identity") {
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, seerId, action, {
        phase: Phase.Night,
      });
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const inspection = resolveInspection(ctx.world, targetId, "camp", ctx.roleCatalog);
      if (!inspection) continue;
      const isWerewolf = inspection.camp === Camp.Wolf;
      const seerRole = ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role);
      const seerState = seerRole ? getSeerState(seerRole) : undefined;
      if (seerState) {
        seerState.lastTarget = targetId;
        seerState.lastIsWerewolf = isWerewolf;
        seerState.lastResult = { ...inspection };
        seerState.history.push({ targetId, isWerewolf, result: { ...inspection } });
      }

      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf, result: { ...inspection } });
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: { actorId: seerId, targetId, isWerewolf, result: { ...inspection } },
      });
    }
  },
};

/** 预言家夜间阶段列表。 */
export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];
