/**
 * 负责单个目标的原夜间保护判定与致死来源规则。
 * 输入为只读折叠计划、原效果查询与当前印记读者；输出保留该目标的原死因顺序。
 * 仅专用取消命令可在原同守同救分支移除 Guard／Heal，不能添加或清空印记、修改生命、
 * 发布事实或消费库存。梦境、免疫与修饰效果保持晚读取及原失败前缀。
 * 原毒／反射毒使用折叠后的 owned 因果去向；外部 legacy 保留原集合后备政策。
 * 普通狼刀、机械额外刀和觉醒额外刀保留各自的保护规则，不归并不同死因。
 */
import { DeathCause } from "./deaths";
import { StatusMark, type EntityId } from "./identity";
import type { StatusMarksComponent } from "./components/status-marks";
import {
  livingNightLife,
  nightPoisonRouteTargets,
  nightPoisonRoutes,
  type NightPoisonRoute,
  type NightEffectQuery,
  type NightLifeReadScope,
} from "./night-effects";
import type { NightDamageEffects, NightDamagePlan } from "./night-damage-plan";

/**
 * 仅保留本目标在原时点查询的字段；不传入毒源、守护印记或库存命令。
 * 修饰死亡保留原生命引用，但此处只能读取，不能写入 Alive。
 */
export type NightDamageTargetEffects = Readonly<
  Pick<
    NightDamageEffects,
    "wolfImmuneTargets" | "protectedTargets" | "immuneNightTargets" | "consecutiveDeaths"
  >
> & {
  readonly modifierDeaths?: readonly NightLifeReadScope[];
};

/** 在原印记处理时点解析一个目标，不提前快照效果或重查有效性。 */
export function resolveNightDamageTarget(
  world: NightEffectQuery,
  entityId: EntityId,
  effects: NightDamageTargetEffects,
  plan: NightDamagePlan,
  marks: Readonly<Pick<StatusMarksComponent, "has">> | undefined,
  cancelOrdinaryProtection: () => void,
  captureAcceptedPoison?: (routes: readonly NightPoisonRoute[]) => void,
): DeathCause[] {
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
  } = plan;
  // 原追加顺序保留：查验／反击在前，随后子狐、毒、各刀及反噬；不能统一排序。
  const sources: DeathCause[] = [...(inspectionSources.get(entityId) ?? [])];
  const hasGuard =
    marks?.has(StatusMark.GuardMark) === true &&
    (!claimedGuardTargets.has(entityId) || guarded.has(entityId));
  const hasHeal = marks?.has(StatusMark.HealMark) === true;
  // 保存进入此分支时的守／救读值；取消之后不重读印记，机械与觉醒刀仍用各自保护政策。
  const effectiveHeal = hasHeal && !hasGuard;
  const hasWolfKill =
    marks?.has(StatusMark.WolfKillMark) === true && !effects.wolfImmuneTargets?.includes(entityId);
  const hasDirectPoison =
    marks?.has(StatusMark.PoisonMark) === true &&
    (!claimedPoisonTargets.has(entityId) ||
      nightPoisonRouteTargets(mechanical, entityId, "direct"));
  const hasPoison = hasDirectPoison || nightPoisonRouteTargets(mechanical, entityId, "reflected");
  // 毒独立于普通守护／解药冲突；不能被同守同救抵消。
  const dreamProtected = effects.protectedTargets?.includes(entityId) === true;
  const mechanicalShield = mechanical.shields.has(entityId);
  const awakenedShield = awakenedShields.has(entityId);
  if (foxInspections.has(entityId) && !dreamProtected) sources.push(DeathCause.FoxInspection);
  if (hasPoison && !dreamProtected && !awakenedShield) {
    sources.push(DeathCause.Poison);
    // 只在真实毒接受点携带来源；direct 复用原已读旗标，不能另查印记或扩大源资格。
    // 已反射路由独立保留，即使同目标同时存在另一直接毒，也不合并其 cause 身份。
    captureAcceptedPoison?.(
      nightPoisonRoutes(mechanical).filter(
        (route) => route.targetId === entityId && (route.route === "reflected" || hasDirectPoison),
      ),
    );
  }

  if (hasGuard && hasHeal) {
    // 同守同救互相抵消，但若同时被狼刀命中仍会死亡。
    // 命令内保留先移除守护、再移除解药的原顺序；第二步失败不能撤销第一步。
    cancelOrdinaryProtection();
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
  // 机械额外刀穿过普通守护，但仍受有效解药、梦境与机械／觉醒盾保护。
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
  // 此处必须晚读取：此前的取消可能已经提交，getter 失败保留已生效前缀。
  const nightImmune = effects.immuneNightTargets?.includes(entityId) === true;
  if (mechanical.failures.has(entityId) && !nightImmune)
    sources.push(DeathCause.MechanicalGuardFailure);
  if (blackBacklashes.has(entityId) && !nightImmune) sources.push(DeathCause.BlackMarketBacklash);
  if (backlashTargets.has(entityId) && !dreamProtected) sources.push(DeathCause.MerchantBacklash);
  if (radiantBacklashes.has(entityId) && !dreamProtected) sources.push(DeathCause.RadiantBacklash);
  if (effects.consecutiveDeaths?.includes(entityId)) sources.push(DeathCause.Dream);

  if (
    effects.modifierDeaths?.some(
      (target) => target.id === entityId && livingNightLife(world, target),
    )
  )
    sources.push(DeathCause.Ability);
  return sources;
}
