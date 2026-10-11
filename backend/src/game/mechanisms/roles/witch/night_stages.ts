import { isTimeConsortBoard, resolveTimeConsortTarget } from "../time_wolf_consort/night_frame";
import { commitTimeConsortEffect } from "../time_wolf_consort/effects";
import { isMagicianBoard, resolveMagicianNightTarget } from "../magician/night_frame";
import { isNightmareBoard } from "../nightmare_shadow/night_frame";
import { commitEvilKnightReflection } from "../evil_knight/state";
import { isEvilKnightBoard, assertEvilKnightNativeActor } from "../evil_knight/night_frame";
import { demonHunterActorId, demonWitchRequiredThisNight } from "../demon_hunter/authority";
/** 文件说明：女巫夜间用药阶段处理。 */
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import {
  Phase,
  PotionType,
  Role,
  StatusMark,
  WitchSelfHealRule,
} from "../../../../core/domain/model";
import { type NightAbility } from "../abilities";
import { nativePotionsCanCombine, witchKnifeVisible } from "./policies";
import { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import { getWitchState } from "../private_state";
import {
  activeNightAbility,
  allNightAbilities,
  nightAbilityActors,
  recordNightAbilityUse,
} from "../abilities";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";
import { captureNightAbilityScope } from "../ability_scope";

const resetNightRoleStateStage: NightStageHandler = {
  id: "reset_night_role_state",
  priority: 100,
  async execute(ctx): Promise<void> {
    if (demonHunterActorId(ctx.world) !== null) return;
    for (const id of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      for (const ability of allNightAbilities(role)) {
        if (ability.kind !== "potion") continue;
        const witchState = ability.state;
        witchState.healUsedThisNight = false;
        witchState.poisonUsedThisNight = false;
        witchState.canSelfHeal =
          witchState.selfHealRule === WitchSelfHealRule.Always ||
          (witchState.selfHealRule === WitchSelfHealRule.FirstNightOnly && ctx.currentDay() === 1);
      }
    }
  },
};

const witchActionStage: NightStageHandler = {
  id: "witch_action",
  priority: 500,
  async execute(ctx): Promise<void> {
    if (demonHunterActorId(ctx.world) !== null) {
      if (!demonWitchRequiredThisNight(ctx.world)) return;
      const { executeDemonWitchTurn } = await import("../demon_hunter/native_potion_controller");
      const result = await executeDemonWitchTurn({
        world: ctx.world,
        gateway: ctx.toolGateway,
        events: ctx.events,
        provider: ctx.actionProvider,
        day: ctx.currentDay(),
        wolfTarget: ctx.state.wolfTarget,
      });
      if (result.poison) (ctx.state.poisonClaims ??= []).push(result.poison.claim);
      return;
    }
    for (const { actorId: witchId, ability } of nightAbilityActors(
      ctx.world,
      "potion",
      ctx.currentDay(),
    )) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      const day = ctx.currentDay();
      const ownership = captureNightAbilityScope(
        ctx.world,
        witchId,
        ability,
        day,
        () => ctx.isCurrent() && ctx.currentDay() === day,
      );
      if (!ownership?.isEligible()) continue;
      const close = () => {
        if (ownership.isOwnerCurrent() && !ability.disabled && !ability.deathExpired)
          ability.state.potionTurnClosedDay = day;
      };
      const both = nativePotionsCanCombine(ability);
      for (let turn = 0; turn < (both ? 2 : 1); turn++) {
        if (
          !activeNightAbility(
            ctx.world.getComponent<RoleComponent>(witchId, COMPONENT.Role),
            "potion",
            ctx.currentDay(),
            ability.id,
          )
        )
          break;
        const used = await executePotionTurn(ctx, witchId, ability);
        if (!ctx.isCurrent()) return;
        if (!used) {
          if (both) close();
          break;
        }
      }
      if (both) close();
    }
  },
};

/** 女巫夜间阶段列表。 */
export const WITCH_NIGHT_STAGES: NightStageHandler[] = [resetNightRoleStateStage, witchActionStage];

async function executePotionTurn(
  ctx: NightStageContext,
  witchId: number,
  ability: NightAbility<"potion">,
): Promise<boolean> {
  assertEvilKnightNativeActor(ctx.world, witchId, Role.Witch);
  if (
    isEvilKnightBoard(ctx.world) &&
    (ability.source.kind !== "native" || ability.source.role !== Role.Witch)
  )
    throw new Error("evil_knight_witch_source_invalid");
  const day = ctx.currentDay();
  const scope = captureNightAbilityScope(
    ctx.world,
    witchId,
    ability,
    day,
    () => ctx.isCurrent() && ctx.currentDay() === day,
  );
  if (!scope?.isEligible()) return false;
  ability.state.canSelfHeal =
    ability.state.selfHealRule === WitchSelfHealRule.Always ||
    (ability.state.selfHealRule === WitchSelfHealRule.FirstNightOnly && day === 1);
  const targets = new Map(
    ctx.world.getAliveEntityIds().map((id) => [id, captureNightLife(ctx.world, id)]),
  );
  const attribution = ability.source.kind === "native" ? {} : { abilityId: ability.id };
  const req = ctx.makeRequest(witchId, ["use_potion"], {
    stage: "witch",
    ability_id: ability.id,
    ...(witchKnifeVisible(ability) ? { wolf_target: ctx.state.wolfTarget } : {}),
  });
  if (!scope.isEligible()) {
    if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_witch_scope_stale");
    return false;
  }
  const action = await ctx.actionProvider.getAction(req);
  if (!ctx.isCurrent()) return false;
  if (!scope.isEligible()) {
    if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_witch_scope_stale");
    return false;
  }
  if (action?.name !== "use_potion") {
    if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_witch_action_missing");
    if (isMagicianBoard(ctx.world)) throw new Error("magician_witch_action_missing");
    if (isEvilKnightBoard(ctx.world) || isNightmareBoard(ctx.world))
      throw new Error(
        isNightmareBoard(ctx.world)
          ? "nightmare_witch_action_missing"
          : "evil_knight_witch_action_missing",
      );
    ctx.events.push({
      timestamp: Date.now(),
      type: "witch_potion_skipped",
      payload: {
        actorId: witchId,
        ...attribution,
        targetId: null,
        potionType: PotionType.None,
        reason: "no_action",
      },
    });
    return false;
  }

  const result = ctx.toolGateway.validateAndSanitize(ctx.world, witchId, action, {
    phase: Phase.Night,
    day: ctx.currentDay(),
    abilityId: ability.id,
  });
  if (!ctx.isCurrent()) return false;
  if (!scope.isEligible()) {
    if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_witch_scope_stale");
    return false;
  }
  if (!result.ok || !result.sanitizedCall) {
    if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_witch_action_invalid");
    if (isMagicianBoard(ctx.world)) throw new Error("magician_witch_action_invalid");
    if (isEvilKnightBoard(ctx.world) || isNightmareBoard(ctx.world))
      throw new Error(
        isNightmareBoard(ctx.world)
          ? "nightmare_witch_action_invalid"
          : "evil_knight_witch_action_invalid",
      );
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
    return false;
  }

  const witch = ctx.world.getComponent<RoleComponent>(witchId, COMPONENT.Role);
  if (!activeNightAbility(witch, "potion", ctx.currentDay(), ability.id)) return false;
  const witchState = witch ? getWitchState(witch, ability.id) : undefined;
  if (!witchState) {
    return false;
  }
  const targetId = result.sanitizedCall.args.target_id;
  const potion = result.sanitizedCall.args.potion_type;
  const requestedTarget = targets.get(targetId);
  if (
    potion !== PotionType.None &&
    (!requestedTarget || !livingNightLife(ctx.world, requestedTarget))
  )
    return false;
  const mapping =
    potion !== PotionType.None && isMagicianBoard(ctx.world)
      ? resolveMagicianNightTarget(ctx.world, day, targetId)
      : null;
  if (mapping && !mapping.isCurrent()) throw new Error("magician_potion_target_stale");
  const receipt =
    potion === PotionType.Poison && isTimeConsortBoard(ctx.world)
      ? resolveTimeConsortTarget(ctx.world, day, witchId, targetId, "poison")
      : null;
  if (receipt && (ability.source.kind !== "native" || ability.source.role !== Role.Witch))
    throw new Error("time_consort_witch_source_invalid");
  const effectiveId = receipt?.effectiveId ?? mapping?.effectiveId ?? targetId;
  const target = receipt?.scope ?? mapping?.scope ?? requestedTarget;

  if (potion === "heal") {
    if (
      witchState.heal <= 0 ||
      witchState.healUsedThisNight ||
      (witchState.poisonUsedThisNight && !nativePotionsCanCombine(ability))
    )
      return false;
    recordNightAbilityUse(ability, day, true);
    ctx.ensureMarks(effectiveId).add(StatusMark.HealMark);
    witchState.heal -= 1;
    witchState.healUsedThisNight = true;
    ctx.events.push({
      timestamp: Date.now(),
      type: "witch_potion_used",
      payload: { actorId: witchId, ...attribution, targetId, potionType: PotionType.Heal },
    });
  }

  if (potion === "poison") {
    if (
      witchState.poison <= 0 ||
      witchState.poisonUsedThisNight ||
      (witchState.healUsedThisNight && !nativePotionsCanCombine(ability))
    )
      return false;
    if (!luckyTargetAllowed(ctx.world, witchId, ability, day, "poison", targetId)) return false;
    const source = captureNightLife(ctx.world, witchId);
    if (!source || !target) return false;
    commitTimeConsortEffect(ctx, receipt, day, witchId, "poison");
    recordNightAbilityUse(ability, day, true);
    (ctx.state.poisonClaims ??= []).push({ source, target });
    ctx.ensureMarks(effectiveId).add(StatusMark.PoisonMark);
    witchState.poison -= 1;
    witchState.poisonUsedThisNight = true;
    if (isEvilKnightBoard(ctx.world)) {
      if (ability.source.kind !== "native" || ability.source.role !== Role.Witch)
        throw new Error("evil_knight_witch_source_invalid");
      const reflection = commitEvilKnightReflection(
        ctx.world,
        ctx.state.evilKnightBindings?.get(targetId) ?? null,
        source,
        "poison",
        () => scope.isOwnerCurrent() && !ability.disabled && !ability.deathExpired,
      );
      if (reflection) (ctx.state.retaliationAttacks ??= []).push(reflection);
    }
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
  if (potion === PotionType.None) recordNightAbilityUse(ability, day, false);
  return potion !== PotionType.None;
}
