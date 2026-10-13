/**
 * 负责运行时夜间效果声明、原生命身份检查与机械伤害折叠。
 * 输入为原组件引用和具有来源的效果；输出为捕获的生命版本及原机械伤害计划。
 * 所有者保留资源提交权限，句柄不进入序列化或玩家知识，本模块不将玩家标记为死亡。
 */
import type { DeathCause } from "./deaths";
import { COMPONENT } from "./components/names";
import { aliveLifeVersion, type AliveComponent } from "./components/alive";
import type { World } from "./world";
import type { EntityId } from "./identity";
import type { StatusMarksComponent } from "./components/status_marks";

/** 查询原生命和印记身份，不暴露组件修改命令。 */
export interface NightEffectQuery {
  getComponent(id: EntityId, name: typeof COMPONENT.Alive): Readonly<AliveComponent> | undefined;
  getComponent(id: EntityId, name: typeof COMPONENT.StatusMarks): object | undefined;
}

/** 仅供运行时的身份绑定；组件引用不进入事件或录制。 */
export interface NightLifeScope {
  readonly id: EntityId;
  readonly life: AliveComponent;
  readonly version: number;
}
/** 同一原体的只读查询视图；不复制组件，也不授予修改存活状态的权限。 */
export type NightLifeReadScope = Omit<NightLifeScope, "life"> & {
  readonly life: Readonly<AliveComponent>;
};
export interface NightPoisonClaim {
  readonly source: NightLifeScope;
  readonly target: NightLifeScope;
  readonly isCurrent?: () => boolean;
}
export interface NightFoxInspectionClaim {
  readonly target: NightLifeScope;
  /** 首日警长结算前切换阶段不会撤销原目标绑定。 */
  readonly isTargetCurrent: () => boolean;
  readonly isCurrent: () => boolean;
}
export interface NightGuardClaim {
  readonly isCurrent?: () => boolean;
  readonly contribution?: object;
  readonly target: NightLifeScope;
  readonly marks: StatusMarksComponent;
}
export interface NightMerchantBacklash {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
export interface NightBlackMarketBacklash {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
/** 吞噬反噬是独立攻击，不归入商人效果或梦境死亡。 */
export interface NightRadiantBacklash {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
export function captureNightLife(world: World, id: EntityId): NightLifeScope | null {
  const life = world.getComponent(id, COMPONENT.Alive),
    version = life && aliveLifeVersion(life);
  return life?.alive && version !== undefined ? { id, life, version } : null;
}
export function sameNightLife(world: NightEffectQuery, scope: NightLifeReadScope): boolean {
  return (
    world.getComponent(scope.id, COMPONENT.Alive) === scope.life &&
    aliveLifeVersion(scope.life) === scope.version
  );
}
export function livingNightLife(world: NightEffectQuery, scope: NightLifeReadScope): boolean {
  return sameNightLife(world, scope) && scope.life.alive;
}

/** 已提交机械效果绑定原体；库存仍由具体机制所有者持有。 */
export interface NightMechanicalEffect {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  /** 只读重检提交者的角色、状态、生命与阶段，不修改原体。 */
  readonly isCurrent: () => boolean;
}
export interface NightMechanicalEffects {
  readonly shields: readonly NightMechanicalEffect[];
  readonly attacks: readonly NightMechanicalEffect[];
  readonly failures: readonly NightMechanicalEffect[];
}
/** 觉醒守护吸收毒药；其额外狼刀按普通保护规则判定。 */
export interface NightAwakenedEffect {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  /** 已付款效果重检原所有者；行动窗口关闭不等于撤销合法已付效果。 */
  readonly isCurrent: () => boolean;
}
export interface NightAwakenedEffects {
  readonly shields: readonly NightAwakenedEffect[];
  readonly attacks: readonly NightAwakenedEffect[];
}
/** 仅全知视角的因果事实；玩家投影不得泄露施毒来源。 */
export interface NightPoisonReflection {
  readonly actorId: EntityId;
  readonly protectedTargetId: EntityId;
  readonly casterId: EntityId;
}
export interface MechanicalDamagePlan {
  readonly shields: ReadonlySet<EntityId>;
  readonly directPoisonTargets: ReadonlySet<EntityId>;
  readonly reflectedPoisonTargets: ReadonlySet<EntityId>;
  readonly attacks: ReadonlySet<EntityId>;
  readonly failures: ReadonlySet<EntityId>;
  readonly reflections: readonly NightPoisonReflection[];
}
/** 每份原毒只折叠一次；反射毒不再送回盾内，避免递归反射。 */
export function planMechanicalDamage(
  world: NightEffectQuery,
  effects: NightMechanicalEffects | undefined,
  poisons: readonly NightPoisonClaim[] = [],
  absorbedPoisonTargets: ReadonlySet<EntityId> = new Set(),
): MechanicalDamagePlan {
  const shields = new Map<EntityId, NightMechanicalEffect>();
  for (const shield of effects?.shields ?? []) {
    if (shield.isCurrent() && livingNightLife(world, shield.target)) {
      shields.set(shield.target.id, shield);
    }
  }
  const directPoisonTargets = new Set<EntityId>();
  const reflectedPoisonTargets = new Set<EntityId>();
  const reflections: NightPoisonReflection[] = [];
  for (const poison of poisons) {
    if (
      poison.isCurrent?.() === false ||
      !livingNightLife(world, poison.target) ||
      absorbedPoisonTargets.has(poison.target.id)
    )
      continue;
    const shield = shields.get(poison.target.id);
    if (!shield) {
      directPoisonTargets.add(poison.target.id);
      continue;
    }
    if (livingNightLife(world, poison.source)) {
      reflectedPoisonTargets.add(poison.source.id);
      reflections.push({
        actorId: shield.actorId,
        protectedTargetId: poison.target.id,
        casterId: poison.source.id,
      });
    }
  }
  const attacks = new Set<EntityId>();
  const failures = new Set<EntityId>();
  for (const attack of effects?.attacks ?? []) {
    if (attack.isCurrent() && livingNightLife(world, attack.target)) attacks.add(attack.target.id);
  }
  for (const failure of effects?.failures ?? []) {
    if (failure.isCurrent() && livingNightLife(world, failure.target))
      failures.add(failure.target.id);
  }
  return {
    shields: new Set(shields.keys()),
    directPoisonTargets,
    reflectedPoisonTargets,
    attacks,
    failures,
    reflections,
  };
}

/** 有限纯白查验规则的原所有者与目标绑定。 */
export interface NightInspectionAttack {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  readonly cause: DeathCause.PureWhiteInspection | DeathCause.WolfWitchInspection;
  readonly isCurrent: () => boolean;
}

/** 恶灵骑士反击在原行动接受时付款，于夜末按原体绑定结算。 */
export interface NightRetaliationAttack {
  readonly actorId: EntityId;
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}

/** 持续被动夜间免疫保留原生命与角色授权。 */
export interface NightImmunityClaim {
  readonly target: NightLifeScope;
  readonly isCurrent: () => boolean;
}
