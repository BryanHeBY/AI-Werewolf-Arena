/**
 * 负责将原夜间效果声明折叠为伤害结算使用的只读计划。
 * 输入保留原生命句柄与已付款 owner 的有效性回调；输出集合和死因顺序仅属于本次结算。
 * 通过窄查询端口读取生命与印记身份，不修改库存、印记或存活状态。
 * 在原 target/source 读取点消费新 owned intent；kind/day/原体拒绝是新协议约束，
 * 旧注入输入不读额外 metadata/getter，拒绝不回滚前面合法付款或事实。
 * 保留原 getter、回调、毒吸收与单次反射的执行顺序；每玩家的晚读取和印记清理由结算器负责。
 * 运行时句柄与集合不会进入序列化归档，也不是玩家可见事实。
 */
import { COMPONENT } from "./components/names";
import { DeathCause } from "./deaths";
import type { EntityId } from "./identity";
import {
  planMechanicalDamage,
  type NightEffectQuery,
  type MechanicalDamagePlan,
  livingNightLife,
  nightIntentTarget,
  type NightPoisonClaim,
  type NightInspectionAttack,
  type NightRetaliationAttack,
  type NightImmunityClaim,
  type NightFoxInspectionClaim,
  type NightGuardClaim,
  type NightMechanicalEffects,
  type NightMerchantBacklash,
  type NightBlackMarketBacklash,
  type NightRadiantBacklash,
  type NightAwakenedEffects,
} from "./night-effects";

export interface NightDamageEffects {
  /** 原 Pipeline 的已捕获 day；仅新 owned intent 读取，旧注入输入不访问额外字段。 */
  intentNight?: number;
  radiantShelters?: readonly NightImmunityClaim[];
  /** 具名交易保护仅免普通刀、毒和梦；带原体与已付当前性，不加入全伤害免疫。 */
  wardenProtections?: readonly NightImmunityClaim[];
  wardenDeals?: readonly import("./night-effects").NightDealClaim[];
  radiantBacklashes?: readonly NightRadiantBacklash[];
  modifierDeaths?: readonly import("./night-effects").NightLifeScope[];
  nightImmunities?: readonly NightImmunityClaim[];
  retaliationAttacks?: readonly NightRetaliationAttack[];
  inspectionAttacks?: readonly NightInspectionAttack[];
  protectedTargets?: readonly EntityId[];
  wolfImmuneTargets?: readonly EntityId[];
  foxInspections?: readonly NightFoxInspectionClaim[];
  /** 具有来源的夜间免疫；扩展效果的交互遵循现有 AWA 规则。 */
  immuneNightTargets?: readonly EntityId[];
  consecutiveDeaths?: readonly EntityId[];
  poisonClaims?: readonly NightPoisonClaim[];
  guardClaims?: readonly NightGuardClaim[];
  healClaims?: readonly import("./night-effects").NightHealClaim[];
  merchantBacklashes?: readonly NightMerchantBacklash[];
  blackMarketBacklashes?: readonly NightBlackMarketBacklash[];
  mechanicalEffects?: NightMechanicalEffects;
  awakenedEffects?: NightAwakenedEffects;
}

/** 本次运行的折叠结果；集合只读，当前实体印记仍由结算器消费。 */
export interface NightDamagePlan {
  readonly healing?: {
    readonly claimed: ReadonlySet<EntityId>;
    readonly healed: ReadonlySet<EntityId>;
  };
  readonly awakenedShields: ReadonlySet<EntityId>;
  readonly awakenedAttacks: ReadonlySet<EntityId>;
  readonly mechanical: MechanicalDamagePlan;
  readonly claimedPoisonTargets: ReadonlySet<EntityId>;
  readonly claimedGuardTargets: ReadonlySet<EntityId>;
  readonly guarded: ReadonlySet<EntityId>;
  readonly blackBacklashes: ReadonlySet<EntityId>;
  readonly radiantBacklashes: ReadonlySet<EntityId>;
  readonly backlashTargets: ReadonlySet<EntityId>;
  readonly foxInspections: ReadonlySet<EntityId>;
  readonly inspectionSources: ReadonlyMap<EntityId, ReadonlySet<DeathCause>>;
  readonly passiveImmuneTargets: ReadonlySet<EntityId>;
}

/** 在原 resolve 时点仅求值一次，传入同一 World，保留查询方法的 receiver。 */
export function planNightDamage(
  world: NightEffectQuery,
  effects: NightDamageEffects,
): NightDamagePlan {
  const awakenedShields = new Set(
    effects.awakenedEffects?.shields
      .filter(
        (effect) =>
          effect.isCurrent() &&
          livingNightLife(
            world,
            nightIntentTarget(effect, "awakened-shield", () => effects.intentNight),
          ),
      )
      .map((effect) => nightIntentTarget(effect, "awakened-shield", () => effects.intentNight).id),
  );
  const awakenedAttacks = new Set(
    effects.awakenedEffects?.attacks
      .filter(
        (effect) =>
          effect.isCurrent() &&
          livingNightLife(
            world,
            nightIntentTarget(effect, "awakened-attack", () => effects.intentNight),
          ),
      )
      .map((effect) => nightIntentTarget(effect, "awakened-attack", () => effects.intentNight).id),
  );
  // 先吸收原毒，避免其进入机械反射；返回毒随后仍按目标保护独立判定。
  const mechanical = planMechanicalDamage(
    world,
    effects.mechanicalEffects,
    effects.poisonClaims,
    awakenedShields,
    () => effects.intentNight,
  );
  const claimedPoisonTargets = new Set(
    effects.poisonClaims?.map(
      (claim) => nightIntentTarget(claim, "original-poison", () => effects.intentNight).id,
    ),
  );
  const claimedGuardTargets = new Set(effects.guardClaims?.map((claim) => claim.target.id));
  // 守护仍只检查原生命与印记对象身份；不能额外调用 isCurrent 改变既有规则。
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
  const radiantBacklashes = new Set(
    effects.radiantBacklashes
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
    [...(effects.nightImmunities ?? []), ...(effects.radiantShelters ?? [])]
      .filter((claim) => claim.isCurrent() && livingNightLife(world, claim.target))
      .map((claim) => claim.target.id),
  );
  return {
    ...(Object.hasOwn(effects, "healClaims")
      ? {
          healing: {
            claimed: new Set(effects.healClaims?.map((c) => c.target.id)),
            healed: new Set(
              effects.healClaims
                ?.filter(
                  (c) =>
                    c.isCurrent() &&
                    livingNightLife(world, c.target) &&
                    world.getComponent(c.target.id, COMPONENT.StatusMarks) === c.marks,
                )
                .map((c) => c.target.id),
            ),
          },
        }
      : {}),
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
  };
}
