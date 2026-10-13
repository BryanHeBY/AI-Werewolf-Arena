/**
 * 负责女巫每夜标记复位和原捕获瓶数/目标的用药选择。
 * 输入为当前 native/granted potion 与已验证行动；输出保留已付救/毒、跳过和历史。
 * 原毒 intent 从原 source/target/day 及原请求读取点捕获的 abilityId 生成，不增加时钟/World/RNG读取。
 * 付款、目标映射、第二次行动、角色专有失败和 poison-only 限制保持原位置。
 * 来源句柄只供运行时消费，不进入玩家信息或 schema2；瓶数／旗标归 Witch 状态 owner，公共次数归实例 owner。
 */
/** 文件说明：女巫夜间用药阶段处理。 */
import {
  captureNightLife,
  livingNightLife,
  originalPoisonIntent,
} from "../../../../core/domain/night_effects";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import {
  Phase,
  PotionType,
  Role,
  StatusMark,
  WitchSelfHealRule,
} from "../../../../core/domain/model";
import { type NightAbilityReadView } from "../abilities";
import { nativePotionsCanCombine, witchKnifeVisible } from "./policies";
import { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import {
  getWitchState,
  resetWitchNightState,
  refreshWitchSelfHeal,
  closeWitchPotionTurn,
  consumeWitchHeal,
  consumeWitchPoison,
} from "./state";
import { activeNightAbility, allNightAbilities } from "../abilities";
import { recordNightAbilityUse } from "../ability_changes";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";
import { captureNightAbilityScope } from "../ability_scope";

const resetNightRoleStateStage: NightStageHandler = {
  id: "reset_night_role_state",
  priority: 100,
  async execute(ctx): Promise<void> {
    if (ctx.nativeNightFailure.usesDemonController()) return;
    for (const id of ctx.world.getAliveEntityIds()) {
      const role = ctx.world.getComponent(id, COMPONENT.Role);
      for (const ability of allNightAbilities(role)) {
        if (ability.kind !== "potion") continue;
        const witchState = ability.state;
        resetWitchNightState(witchState, () => ctx.currentDay());
      }
    }
  },
};

const witchActionStage: NightStageHandler = {
  id: "witch_action",
  priority: 500,
  async execute(ctx): Promise<void> {
    if (ctx.nativeNightFailure.usesDemonController()) {
      if (!ctx.nativeNightFailure.requiresDemonPotionTurn()) return;
      const { executeDemonWitchTurn } = await ctx.nativeNightEffects.loadSealedPotionController();
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
    for (const { actorId: witchId, ability } of ctx.nightActors.actors(
      "potion",
      ctx.currentDay(),
    )) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      if (ctx.nativeNightFailure.skipsEmptyBorrowedPotion(ability)) continue;
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
          closeWitchPotionTurn(ability, day);
      };
      const both = nativePotionsCanCombine(ability);
      for (let turn = 0; turn < (both ? 2 : 1); turn++) {
        if (
          !activeNightAbility(
            ctx.world.getComponent(witchId, COMPONENT.Role),
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
  ability: NightAbilityReadView<"potion">,
): Promise<boolean> {
  ctx.nativeNightFailure.assertNativeActor(witchId, Role.Witch);
  ctx.nativeNightFailure.assertPotionSource(ability);
  const day = ctx.currentDay();
  const scope = captureNightAbilityScope(
    ctx.world,
    witchId,
    ability,
    day,
    () => ctx.isCurrent() && ctx.currentDay() === day,
  );
  if (!scope?.isEligible()) return false;
  refreshWitchSelfHeal(ability, day);
  const targets = new Map(
    ctx.world.getAliveEntityIds().map((id) => [id, captureNightLife(ctx.world, id)]),
  );
  const attribution = ability.source.kind === "native" ? {} : { abilityId: ability.id };
  let effectAbilityId: string;
  const req = ctx.makeRequest(witchId, ["use_potion"], {
    stage: "witch",
    ...ctx.nativeNightTargets.potionModifierHints(witchId),
    ability_id: (effectAbilityId = ability.id),
    ...(witchKnifeVisible(ability)
      ? {
          wolf_target: ctx.state.wolfTarget,
          ...ctx.nativeNightTargets.potionKnifeHints(),
        }
      : {}),
  });
  if (!scope.isEligible()) {
    ctx.nativeNightFailure.scopeStale("witch");
    return false;
  }
  const action = await ctx.actionProvider.getAction(req);
  if (!ctx.isCurrent()) return false;
  if (!scope.isEligible()) {
    ctx.nativeNightFailure.scopeStale("witch");
    return false;
  }
  if (action?.name !== "use_potion") {
    ctx.nativeNightFailure.actionMissing("witch");
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
    ctx.nativeNightFailure.scopeStale("witch");
    return false;
  }
  if (!result.ok || !result.sanitizedCall) {
    ctx.nativeNightFailure.actionInvalid("witch");
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

  const witch = ctx.world.getComponent(witchId, COMPONENT.Role);
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
    potion !== PotionType.None
      ? ctx.nativeNightTargets.mappedTarget(
          () => day,
          () => targetId,
        )
      : null;
  if (mapping && !mapping.isCurrent()) throw new Error("magician_potion_target_stale");
  const receipt =
    potion === PotionType.Poison
      ? ctx.nativeNightTargets.reflectedTarget(
          () => day,
          () => witchId,
          () => targetId,
          "poison",
        )
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
    consumeWitchHeal(witchState);
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
    ctx.nativeNightEffects.commitReflectedTarget(receipt, day, witchId, "poison");
    recordNightAbilityUse(ability, day, true);
    (ctx.state.poisonClaims ??= []).push(
      originalPoisonIntent(
        { source, target },
        {
          family: "witch",
          day,
          stage: "witch",
          actorLife: source,
          requestedTargetId: targetId,
          abilityId: effectAbilityId,
        },
      ),
    );
    ctx.ensureMarks(effectiveId).add(StatusMark.PoisonMark);
    consumeWitchPoison(witchState);
    ctx.nativeNightEffects.commitNativeReflection(
      "poison",
      ability,
      targetId,
      () => source,
      () => scope.isOwnerCurrent() && !ability.disabled && !ability.deathExpired,
    );
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
  ctx.nativeNightEffects.recordModifierTarget(day, witchId, "poison", () =>
    potion === PotionType.Poison ? targetId : null,
  );
  return potion !== PotionType.None;
}
