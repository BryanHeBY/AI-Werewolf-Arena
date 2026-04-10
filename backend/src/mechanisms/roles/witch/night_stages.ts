import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Phase, Role, StatusMark } from "../../../domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getWitchState } from "../private_state";

const resetNightRoleStateStage: NightStageHandler = {
  id: "reset_night_role_state",
  priority: 100,
  async execute(ctx): Promise<void> {
    for (const id of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      const witchState = role ? getWitchState(role) : undefined;
      if (witchState) {
        witchState.healUsedThisNight = false;
        witchState.poisonUsedThisNight = false;
      }
    }
  },
};

const witchActionStage: NightStageHandler = {
  id: "witch_action",
  priority: 500,
  async execute(ctx): Promise<void> {
    for (const witchId of ctx.getAliveByRole(Role.Witch)) {
      const req = ctx.makeRequest(witchId, ["use_potion"], {
        phase: "witch",
        wolf_target: ctx.state.wolfTarget,
      });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "use_potion") {
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, witchId, action, {
        phase: Phase.Night,
      });
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const witch = ctx.world.getComponent<RoleComponent>(witchId, COMPONENT.Role);
      const witchState = witch ? getWitchState(witch) : undefined;
      if (!witchState) {
        continue;
      }
      const targetId = result.sanitizedCall.args.target_id;
      const potion = result.sanitizedCall.args.potion_type;

      if (potion === "heal") {
        ctx.ensureMarks(targetId).add(StatusMark.HealMark);
        witchState.heal -= 1;
        witchState.healUsedThisNight = true;
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: { actorId: witchId, targetId, potionType: "heal" },
        });
      }

      if (potion === "poison") {
        ctx.ensureMarks(targetId).add(StatusMark.PoisonMark);
        witchState.poison -= 1;
        witchState.poisonUsedThisNight = true;
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: { actorId: witchId, targetId, potionType: "poison" },
        });
      }

      if (potion === "none") {
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_skipped",
          payload: { actorId: witchId, targetId, potionType: "none" },
        });
      }
    }
  },
};

export const WITCH_NIGHT_STAGES: NightStageHandler[] = [
  resetNightRoleStateStage,
  witchActionStage,
];
