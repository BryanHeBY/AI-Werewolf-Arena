/** 文件说明：女巫夜间用药阶段处理。 */
import {captureNightLife,livingNightLife} from "../../../../core/domain/night_effects";
import {aliveLifeVersion,type AliveComponent} from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, PotionType, Role, StatusMark, WitchSelfHealRule } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getWitchState } from "../private_state";
import { activeNightAbility, allNightAbilities, nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";

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
      if (ability.activation === "lucky") continue;
      if (!ctx.world.getAliveEntityIds().includes(witchId) || activeNightAbility(ctx.world.getComponent<RoleComponent>(witchId, COMPONENT.Role), "potion", ctx.currentDay(), ability.id) !== ability) continue;
      ability.state.canSelfHeal = ability.state.selfHealRule === WitchSelfHealRule.Always || (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && ctx.currentDay() === 1);
      const day=ctx.currentDay(),originalRole=ctx.world.getComponent<RoleComponent>(witchId,COMPONENT.Role)!,kind=originalRole.role,camp=originalRole.camp,privateState=originalRole.privateState,originalState=ability.state,actorLife=ctx.world.getComponent<AliveComponent>(witchId,COMPONENT.Alive)!,actorVersion=aliveLifeVersion(actorLife);
      const activation = ability.activation, originalAbilityId = ability.id;
      const current=()=>ctx.isCurrent()&&ctx.world.getComponent(witchId,COMPONENT.Role)===originalRole&&originalRole.role===kind&&originalRole.camp===camp&&originalRole.privateState===privateState&&ability.id===originalAbilityId&&activeNightAbility(originalRole,"potion",day,originalAbilityId)===ability&&ability.activation===activation&&ability.state===originalState&&ctx.world.getComponent(witchId,COMPONENT.Alive)===actorLife&&actorLife.alive&&actorVersion!==undefined&&aliveLifeVersion(actorLife)===actorVersion;
      const targets=new Map(ctx.world.getAliveEntityIds().map(id=>[id,captureNightLife(ctx.world,id)]));
      const attribution = ability.source.kind === "native" ? {} : { abilityId: ability.id };
      const req = ctx.makeRequest(witchId, ["use_potion"], {
        stage: "witch",
        ability_id: ability.id,
        ...(ability.state.heal > 0 && !ability.state.healUsedThisNight && !ability.state.poisonUsedThisNight ? { wolf_target: ctx.state.wolfTarget } : {}),
      });
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if(!current())continue;
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
      if(!current())continue;
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
