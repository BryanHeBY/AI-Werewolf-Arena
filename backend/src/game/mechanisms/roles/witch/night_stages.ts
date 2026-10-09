/** 文件说明：女巫夜间用药阶段处理。 */
import {captureNightLife,livingNightLife} from "../../../../core/domain/night_effects";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, PotionType, Role, StatusMark, WitchSelfHealRule } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getWitchState } from "../private_state";
import { activeNightAbility, allNightAbilities, nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";
import { captureNightAbilityScope } from "../ability_scope";

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
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      const day = ctx.currentDay();
      const scope = captureNightAbilityScope(ctx.world, witchId, ability, day, () => ctx.isCurrent() && ctx.currentDay() === day);
      if (!scope?.isEligible()) continue;
      ability.state.canSelfHeal = ability.state.selfHealRule === WitchSelfHealRule.Always || (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
      const targets=new Map(ctx.world.getAliveEntityIds().map(id=>[id,captureNightLife(ctx.world,id)]));
      const attribution = ability.source.kind === "native" ? {} : { abilityId: ability.id };
      const req = ctx.makeRequest(witchId, ["use_potion"], {
        stage: "witch",
        ability_id: ability.id,
        ...(ability.state.heal > 0 && !ability.state.healUsedThisNight && !ability.state.poisonUsedThisNight ? { wolf_target: ctx.state.wolfTarget } : {}),
      });
      if (!scope.isEligible()) continue;
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) continue;
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
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) continue;
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
      const target=targets.get(targetId);
      if(potion!==PotionType.None&&(!target||!livingNightLife(ctx.world,target)))continue;

      if (potion === "heal") {
        if (witchState.heal <= 0 || witchState.healUsedThisNight || witchState.poisonUsedThisNight) continue;
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
        if (witchState.poison <= 0 || witchState.poisonUsedThisNight || witchState.healUsedThisNight) continue;
        if (!luckyTargetAllowed(ctx.world, witchId, ability, day, "poison", targetId)) continue;
        const source=captureNightLife(ctx.world,witchId);if(!source||!target)continue;
        (ctx.state.poisonClaims??=[]).push({source,target});
        ctx.ensureMarks(targetId).add(StatusMark.PoisonMark);
        witchState.poison -= 1;
        witchState.poisonUsedThisNight = true;
        recordOwnNightAction(ctx.world, witchId, day, "poison", targetId, false);
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
