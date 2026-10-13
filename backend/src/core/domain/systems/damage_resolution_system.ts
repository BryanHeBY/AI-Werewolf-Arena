/**
 * Implements dawn damage resolution from current night marks and sourced protection, inspection
 * and retaliation claims. Outputs are pending death IDs, causes and private reflection evidence,
 * while consumed night marks are cleared. It does not write Alive state or run death hooks;
 * those belong to death resolution.
 */
import { COMPONENT } from "../components/names";
import { EntityId, StatusMark, DeathCause, type DeathSources } from "../model";
import { World } from "../world";
import { livingNightLife, type NightPoisonReflection } from "../night_effects";
import { planNightDamage, type NightDamageEffects } from "../night-damage-plan";

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
    const {
      awakenedShields,
      awakenedAttacks,
      mechanical,
      claimedPoisonTargets,
      claimedGuardTargets,
      guarded,
      blackBacklashes,
      radiantBacklashes,
      backlashTargets,
      foxInspections,
      inspectionSources,
      passiveImmuneTargets,
    } = planNightDamage(world, effects);
    for (const entityId of world.getAliveEntityIds()) {
      const marks = world.getComponent(entityId, COMPONENT.StatusMarks);
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
        if (
          !backlashTargets.has(entityId) &&
          !blackBacklashes.has(entityId) &&
          !radiantBacklashes.has(entityId)
        )
          continue;
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
      if (radiantBacklashes.has(entityId) && !dreamProtected)
        sources.push(DeathCause.RadiantBacklash);
      if (effects.consecutiveDeaths?.includes(entityId)) sources.push(DeathCause.Dream);

      if (
        effects.modifierDeaths?.some(
          (target) => target.id === entityId && livingNightLife(world, target),
        )
      )
        sources.push(DeathCause.Ability);
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
