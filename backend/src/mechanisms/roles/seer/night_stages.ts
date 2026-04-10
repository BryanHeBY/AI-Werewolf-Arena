import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Camp, Phase, Role } from "../../../domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState } from "../private_state";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    for (const seerId of ctx.getAliveByRole(Role.Seer)) {
      const req = ctx.makeRequest(seerId, ["check_identity"], {
        phase: "seer",
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
      const targetRole = ctx.world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
      const isWerewolf = targetRole?.camp === Camp.Wolf;
      const seerRole = ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role);
      const seerState = seerRole ? getSeerState(seerRole) : undefined;
      if (seerState) {
        seerState.lastTarget = targetId;
        seerState.lastIsWerewolf = isWerewolf;
        seerState.history.push({ targetId, isWerewolf });
      }

      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf });
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: { actorId: seerId, targetId, isWerewolf },
      });
    }
  },
};

export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];
