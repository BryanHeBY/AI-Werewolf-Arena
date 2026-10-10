import { COMPONENT } from "../components/names";
import { StatusMarksComponent } from "../components/status_marks";
import { EntityId, StatusMark, DeathCause, type DeathSources } from "../model";
import { World } from "../world";
import {
  planMechanicalDamage,
  livingNightLife,
  type NightPoisonClaim,
  type NightInspectionAttack,
  type NightRetaliationAttack,
  type NightImmunityClaim,
  type NightFoxInspectionClaim,
  type NightGuardClaim,
  type NightMechanicalEffects,
  type NightPoisonReflection,
  type NightMerchantBacklash,
  type NightBlackMarketBacklash,
  type NightAwakenedEffects,
} from "../night_effects";

export interface NightDamageEffects {
  nightImmunities?: readonly NightImmunityClaim[];
  retaliationAttacks?: readonly NightRetaliationAttack[];
  inspectionAttacks?: readonly NightInspectionAttack[];
  protectedTargets?: readonly EntityId[];
  wolfImmuneTargets?: readonly EntityId[];
  foxInspections?: readonly NightFoxInspectionClaim[];
  /** Sourced night immunity; extension interactions are an explicit AWA completion. */
  immuneNightTargets?: readonly EntityId[];
  consecutiveDeaths?: readonly EntityId[];
  poisonClaims?: readonly NightPoisonClaim[];
  guardClaims?: readonly NightGuardClaim[];
  merchantBacklashes?: readonly NightMerchantBacklash[];
  blackMarketBacklashes?: readonly NightBlackMarketBacklash[];
  mechanicalEffects?: NightMechanicalEffects;
  awakenedEffects?: NightAwakenedEffects;
}

/**
 * 黎明伤害结算结果。
 */
export interface DamageResolutionResult {
  deaths: EntityId[];
  deathSources: DeathSources;
  /** God-only causal output; never included in a player's night summary or state. */
  poisonReflections?: readonly NightPoisonReflection[];
}

/**
 * 黎明伤害结算系统：
 * - 处理“同守同救”特殊规则
 * - 统一判定狼刀/毒药导致的死亡
 * - 结算后清空当夜印记
 * - 仅返回“待结算死亡名单”，不在此处直接改写存活状态
 */
export class DamageResolutionSystem {
  /**
   * 执行一轮夜间伤害结算并返回死亡与死因信息。
   */
  resolve(world: World, effects: NightDamageEffects = {}): DamageResolutionResult {
    const deaths: EntityId[] = [];
    const deathSources: DeathSources = {};
    const awakenedShields = new Set(
      effects.awakenedEffects?.shields
        .filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
        .map((effect) => effect.target.id),
    );
    const awakenedAttacks = new Set(
      effects.awakenedEffects?.attacks
        .filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
        .map((effect) => effect.target.id),
    );
    // Absorbed original toxins never enter mechanical reflection; returning toxins are checked below.
    const mechanical = planMechanicalDamage(
      world,
      effects.mechanicalEffects,
      effects.poisonClaims,
      awakenedShields,
    );
    const claimedPoisonTargets = new Set(effects.poisonClaims?.map((claim) => claim.target.id));
    const claimedGuardTargets = new Set(effects.guardClaims?.map((claim) => claim.target.id));
    const guarded = new Set(
      effects.guardClaims
        ?.filter(
          (claim) =>
            livingNightLife(world, claim.target) &&
            world.getComponent(claim.target.id, COMPONENT.StatusMarks) === claim.marks,
        )
        .map((claim) => claim.target.id),
    );
    const blackBacklashes = new Set(
      effects.blackMarketBacklashes
        ?.filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
        .map((effect) => effect.target.id),
    );
    const backlashTargets = new Set(
      effects.merchantBacklashes
        ?.filter((effect) => effect.isCurrent() && livingNightLife(world, effect.target))
        .map((effect) => effect.target.id),
    );

    const foxInspections = new Set(
      effects.foxInspections
        ?.filter((claim) => claim.isCurrent() && livingNightLife(world, claim.target))
        .map((claim) => claim.target.id),
    );
    const inspectionSources = new Map<EntityId, Set<DeathCause>>();
    for (const attack of [
      ...(effects.inspectionAttacks ?? []),
      ...(effects.retaliationAttacks ?? []).map((effect) => ({
        ...effect,
        cause: DeathCause.EvilKnightReflection,
      })),
    ]) {
      if (!attack.isCurrent() || !livingNightLife(world, attack.target)) continue;
      const sources = inspectionSources.get(attack.target.id) ?? new Set<DeathCause>();
      sources.add(attack.cause);
      inspectionSources.set(attack.target.id, sources);
    }

    const passiveImmuneTargets = new Set(
      (effects.nightImmunities ?? [])
        .filter((claim) => claim.isCurrent() && livingNightLife(world, claim.target))
        .map((claim) => claim.target.id),
    );
    for (const entityId of world.getAliveEntityIds()) {
      const marks = world.getComponent<StatusMarksComponent>(entityId, COMPONENT.StatusMarks);
      if (passiveImmuneTargets.has(entityId)) {
        marks?.clear();
        continue;
      }
      if (
        !marks &&
        !foxInspections.has(entityId) &&
        !inspectionSources.has(entityId) &&
        !effects.consecutiveDeaths?.includes(entityId) &&
        !mechanical.attacks.has(entityId) &&
        !awakenedAttacks.has(entityId) &&
        !mechanical.failures.has(entityId) &&
        !mechanical.reflectedPoisonTargets.has(entityId)
      ) {
        if (!backlashTargets.has(entityId) && !blackBacklashes.has(entityId)) continue;
      }

      const sources: DeathCause[] = [...(inspectionSources.get(entityId) ?? [])];
      const hasGuard =
        marks?.has(StatusMark.GuardMark) === true &&
        (!claimedGuardTargets.has(entityId) || guarded.has(entityId));
      const hasHeal = marks?.has(StatusMark.HealMark) === true;
      const effectiveHeal = hasHeal && !hasGuard;
      const hasWolfKill =
        marks?.has(StatusMark.WolfKillMark) === true &&
        !effects.wolfImmuneTargets?.includes(entityId);
      const hasDirectPoison =
        marks?.has(StatusMark.PoisonMark) === true &&
        (!claimedPoisonTargets.has(entityId) || mechanical.directPoisonTargets.has(entityId));
      const hasPoison = hasDirectPoison || mechanical.reflectedPoisonTargets.has(entityId);
      // Poison is independent of protection and must survive a conflict.
      const dreamProtected = effects.protectedTargets?.includes(entityId) === true;
      const mechanicalShield = mechanical.shields.has(entityId);
      const awakenedShield = awakenedShields.has(entityId);
      if (foxInspections.has(entityId) && !dreamProtected) sources.push(DeathCause.FoxInspection);
      if (hasPoison && !dreamProtected && !awakenedShield) sources.push(DeathCause.Poison);

      if (hasGuard && hasHeal) {
        // 同守同救互相抵消，但若同时被狼刀命中仍会死亡。
        marks?.remove(StatusMark.GuardMark);
        marks?.remove(StatusMark.HealMark);
        if (hasWolfKill && !dreamProtected && !mechanicalShield && !awakenedShield) {
          sources.push(DeathCause.WolfKill);
        }
      } else {
        if (
          hasWolfKill &&
          !dreamProtected &&
          !mechanicalShield &&
          !awakenedShield &&
          !(hasGuard || hasHeal)
        ) {
          sources.push(DeathCause.WolfKill);
        }
      }
      // An extra knife pierces ordinary Guard, but not Heal, Dream or a mechanical shield.
      if (
        mechanical.attacks.has(entityId) &&
        !effectiveHeal &&
        !dreamProtected &&
        !mechanicalShield &&
        !awakenedShield
      ) {
        sources.push(DeathCause.MechanicalKnife);
      }
      const ordinaryProtection = hasGuard !== hasHeal;
      if (
        awakenedAttacks.has(entityId) &&
        !ordinaryProtection &&
        !dreamProtected &&
        !mechanicalShield &&
        !awakenedShield
      ) {
        sources.push(DeathCause.AwakenedHiddenKnife);
      }
      const nightImmune = effects.immuneNightTargets?.includes(entityId) === true;
      if (mechanical.failures.has(entityId) && !nightImmune)
        sources.push(DeathCause.MechanicalGuardFailure);
      if (blackBacklashes.has(entityId) && !nightImmune)
        sources.push(DeathCause.BlackMarketBacklash);
      if (backlashTargets.has(entityId) && !dreamProtected)
        sources.push(DeathCause.MerchantBacklash);
      if (effects.consecutiveDeaths?.includes(entityId)) sources.push(DeathCause.Dream);

      if (sources.length > 0) {
        deaths.push(entityId);
        deathSources[entityId] = sources;
      }

      marks?.clear();
    }

    return {
      deaths,
      deathSources,
      ...(mechanical.reflections.length ? { poisonReflections: mechanical.reflections } : {}),
    };
  }
}
