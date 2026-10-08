import { COMPONENT } from "../components/names";
import { StatusMarksComponent } from "../components/status_marks";
import { EntityId, StatusMark, DeathCause, type DeathSources } from "../model";
import { World } from "../world";
import { planMechanicalDamage, type NightPoisonClaim, type NightMechanicalEffects } from "../night_effects";

export interface NightDamageEffects {
  protectedTargets?: readonly EntityId[];
  consecutiveDeaths?: readonly EntityId[];
  poisonClaims?: readonly NightPoisonClaim[];
  mechanicalEffects?: NightMechanicalEffects;
}

/**
 * 黎明伤害结算结果。
 */
export interface DamageResolutionResult {
  deaths: EntityId[];
  deathSources: DeathSources;
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
    const mechanical = planMechanicalDamage(world, effects.mechanicalEffects, effects.poisonClaims);
    const claimedPoisonTargets = new Set(effects.poisonClaims?.map(claim => claim.target.id));

    for (const entityId of world.getAliveEntityIds()) {
      const marks = world.getComponent<StatusMarksComponent>(
        entityId,
        COMPONENT.StatusMarks,
      );
      if (!marks && !effects.consecutiveDeaths?.includes(entityId) &&
          !mechanical.attacks.has(entityId) && !mechanical.failures.has(entityId) &&
          !mechanical.reflectedPoisonTargets.has(entityId)) {
        continue;
      }

      const sources: DeathCause[] = [];
      const hasGuard = marks?.has(StatusMark.GuardMark) === true;
      const hasHeal = marks?.has(StatusMark.HealMark) === true;
      const effectiveHeal = hasHeal && !hasGuard;
      const hasWolfKill = marks?.has(StatusMark.WolfKillMark) === true;
      const hasDirectPoison = marks?.has(StatusMark.PoisonMark) === true &&
        (!claimedPoisonTargets.has(entityId) || mechanical.directPoisonTargets.has(entityId));
      const hasPoison = hasDirectPoison || mechanical.reflectedPoisonTargets.has(entityId);
      // Poison is independent of protection and must survive a conflict.
      const dreamProtected = effects.protectedTargets?.includes(entityId) === true;
      const mechanicalShield = mechanical.shields.has(entityId);
      if (hasPoison && !dreamProtected) sources.push(DeathCause.Poison);

      if (hasGuard && hasHeal) {
        // 同守同救互相抵消，但若同时被狼刀命中仍会死亡。
        marks?.remove(StatusMark.GuardMark);
        marks?.remove(StatusMark.HealMark);
        if (hasWolfKill && !dreamProtected && !mechanicalShield) {
          sources.push(DeathCause.WolfKill);
        }
      } else {
        if (hasWolfKill && !dreamProtected && !mechanicalShield && !(hasGuard || hasHeal)) {
          sources.push(DeathCause.WolfKill);
        }
      }
      // An extra knife pierces ordinary Guard, but not Heal, Dream or a mechanical shield.
      if (mechanical.attacks.has(entityId) && !effectiveHeal && !dreamProtected && !mechanicalShield) {
        sources.push(DeathCause.MechanicalKnife);
      }
      if (mechanical.failures.has(entityId)) sources.push(DeathCause.MechanicalGuardFailure);
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
    };
  }
}
