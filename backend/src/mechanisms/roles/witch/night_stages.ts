import { COMPONENT } from "../../../domain/components/names";
import { RoleComponent } from "../../../domain/components/role";
import { Phase, Role, StatusMark } from "../../../domain/model";
import { NightStageHandler } from "../../stages/night/contracts";

const resetNightRoleStateStage: NightStageHandler = {
  id: "reset_night_role_state",
  priority: 100,
  async execute(ctx): Promise<void> {
    for (const id of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (role?.witchState) {
        role.witchState.healUsedThisNight = false;
        role.witchState.poisonUsedThisNight = false;
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
      if (!witch?.witchState) {
        continue;
      }
      const targetId = result.sanitizedCall.args.target_id;
      const potion = result.sanitizedCall.args.potion_type;

      if (potion === "heal") {
        ctx.ensureMarks(targetId).add(StatusMark.HealMark);
        witch.witchState.heal -= 1;
        witch.witchState.healUsedThisNight = true;
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: { actorId: witchId, targetId, potionType: "heal" },
        });
      }

      if (potion === "poison") {
        ctx.ensureMarks(targetId).add(StatusMark.PoisonMark);
        witch.witchState.poison -= 1;
        witch.witchState.poisonUsedThisNight = true;
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: { actorId: witchId, targetId, potionType: "poison" },
        });
      }
    }
  },
};

export const WITCH_NIGHT_STAGES: NightStageHandler[] = [
  resetNightRoleStateStage,
  witchActionStage,
];

