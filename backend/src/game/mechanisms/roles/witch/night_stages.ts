/** 文件说明：女巫夜间用药阶段处理。 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, PotionType, Role, StatusMark, WitchSelfHealRule } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getWitchState } from "../private_state";
import { activeNightAbility, allNightAbilities, nightAbilityActors, recordNightAbilityUse } from "../abilities";

const resetNightRoleStateStage: NightStageHandler = {
  id: "reset_night_role_state",
  priority: 100,
  async execute(ctx): Promise<void> {
    for (const id of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      for (const ability of allNightAbilities(role)) {
        if (ability.kind !== "potion") continue;
        const witchState = ability.state;
        witchState.healUsedThisNight = false;
        witchState.poisonUsedThisNight = false;
        witchState.canSelfHeal =
          witchState.selfHealRule === WitchSelfHealRule.Always ||
          (witchState.selfHealRule === WitchSelfHealRule.FirstNightOnly &&
            ctx.currentDay() === 1);
      }
    }
  },
};

const witchActionStage: NightStageHandler = {
  id: "witch_action",
  priority: 500,
  async execute(ctx): Promise<void> {
    for (const { actorId: witchId, ability } of nightAbilityActors(ctx.world, "potion", ctx.currentDay())) {
      if (!ctx.world.getAliveEntityIds().includes(witchId) || activeNightAbility(ctx.world.getComponent<RoleComponent>(witchId, COMPONENT.Role), "potion", ctx.currentDay(), ability.id) !== ability) continue;
      ability.state.canSelfHeal = ability.state.selfHealRule === WitchSelfHealRule.Always || (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && ctx.currentDay() === 1);
      const attribution = ability.source.kind === "native" ? {} : { abilityId: ability.id };
      const req = ctx.makeRequest(witchId, ["use_potion"], {
        stage: "witch",
        ability_id: ability.id,
        wolf_target: ctx.state.wolfTarget,
      });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "use_potion") {
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_skipped",
          payload: { actorId: witchId, ...attribution, targetId: null, potionType: PotionType.None, reason: "no_action" },
        });
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, witchId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(), abilityId: ability.id,
      });
      if (!result.ok || !result.sanitizedCall) {
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_skipped",
          payload: {
            actorId: witchId,
            ...attribution,
            targetId: action.args.target_id ?? null,
            potionType: PotionType.None,
            reason: "invalid_action",
          },
        });
        continue;
      }

      const witch = ctx.world.getComponent<RoleComponent>(witchId, COMPONENT.Role);
      if (!activeNightAbility(witch, "potion", ctx.currentDay(), ability.id)) continue;
      const witchState = witch ? getWitchState(witch, ability.id) : undefined;
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
          payload: { actorId: witchId, ...attribution, targetId, potionType: PotionType.Heal },
        });
      }

      if (potion === "poison") {
        ctx.ensureMarks(targetId).add(StatusMark.PoisonMark);
        witchState.poison -= 1;
        witchState.poisonUsedThisNight = true;
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_used",
          payload: { actorId: witchId, ...attribution, targetId, potionType: PotionType.Poison },
        });
      }

      if (potion === "none") {
        ctx.events.push({
          timestamp: Date.now(),
          type: "witch_potion_skipped",
          payload: { actorId: witchId, ...attribution, targetId, potionType: PotionType.None },
        });
      }
      recordNightAbilityUse(ability, ctx.currentDay(), potion !== PotionType.None);
    }
  },
};

/** 女巫夜间阶段列表。 */
export const WITCH_NIGHT_STAGES: NightStageHandler[] = [
  resetNightRoleStateStage,
  witchActionStage,
];
