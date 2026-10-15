/**
 * 负责运行时夜间效果声明、原生命身份检查与机械伤害折叠。
 * 输入为原组件引用和已付效果；输出为有来源的 intent、原生命版本及保序伤害折叠。
 * 新 owned intent 消费类别／夜时点／原体因果链，旧注入对象保留原读取和接受宽度。
 * 所有者保留资源提交权限，句柄不进入序列化或玩家知识，本模块不将玩家标记为死亡。
 */
import type { DeathCause } from "./deaths";
import { COMPONENT } from "./components/names";
import { aliveLifeVersion, type AliveComponent } from "./components/alive";
import type { World } from "./world";
import type { EntityId } from "./identity";
import type { StatusMarksComponent } from "./components/status-marks";

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

/**
 * 单次已付效果的运行时来源。源原体及目标句柄仅属于本夜，不进入事件或 schema2。
 * 每份效果的因果 ID 是独立 Symbol；捕获局部值只用于诊断描述，不是去重或稳定归档 ID。
 * 创建身份不读 World、时钟或 RNG，也不授予行动资格。
 */
export interface NightIntentOrigin {
  readonly family:
    | "mechanical"
    | "awakened"
    | "witch"
    | "demon-witch"
    | "lucky"
    | "black-market"
    | "scholar-mentor";
  readonly day: number;
  readonly stage:
    | "mechanical_skill"
    | "mechanical_attack"
    | "awakened_skill"
    | "awakened_attack"
    | "witch"
    | "lucky"
    | "black_market_recipient"
    | "scholar_mentor_bonus";
  readonly actorId: EntityId;
  readonly actorLife: NightLifeReadScope;
  /** 原行动目标；反射不改写它，实际反射落点另存 NightPoisonRoute。 */
  readonly requestedTargetId: EntityId | null;
  /** 创建时绑定的 effect.target.id，与 requestedTargetId 或反射落点分别表达。 */
  readonly effectiveTargetId: EntityId;
  readonly abilityId: string;
  readonly sourceVersion: number;
  readonly targetVersion: number;
  readonly sourceBody: Readonly<AliveComponent>;
  readonly targetBody: Readonly<AliveComponent>;
  /** 每份效果的独立运行时身份；description 只是诊断标签，不能用于去重。 */
  readonly causeId: symbol;
}
export type NightMechanicalIntentKind =
  "mechanical-shield" | "mechanical-attack" | "mechanical-failure";
export type NightAwakenedIntentKind = "awakened-shield" | "awakened-attack";
export type NightIntentKind =
  NightMechanicalIntentKind | NightAwakenedIntentKind | "original-poison";
export interface NightMechanicalIntent<
  K extends NightMechanicalIntentKind = NightMechanicalIntentKind,
> extends NightMechanicalEffect {
  readonly kind: K;
  readonly origin: NightIntentOrigin;
}
export interface NightAwakenedIntent<
  K extends NightAwakenedIntentKind = NightAwakenedIntentKind,
> extends NightAwakenedEffect {
  readonly kind: K;
  readonly origin: NightIntentOrigin;
}
export interface NightOriginalPoisonIntent extends NightPoisonClaim {
  readonly kind: "original-poison";
  readonly origin: NightIntentOrigin;
}
type OriginInput = Omit<
  NightIntentOrigin,
  | "actorId"
  | "effectiveTargetId"
  | "causeId"
  | "sourceVersion"
  | "targetVersion"
  | "sourceBody"
  | "targetBody"
>;

// 只标记由本 owner 构造的对象身份，不复制 effects、不按 World 存第二份状态。
// 旧注入对象即使带有同名 getter，也不被当作新 intent 或读取其额外字段。
const ownedIntents = new WeakSet<object>();
function annotateIntent<T extends { readonly target: NightLifeScope }, K extends NightIntentKind>(
  effect: T,
  kind: K,
  origin: OriginInput,
  actorId: EntityId,
): T & Readonly<{ kind: K; origin: NightIntentOrigin }> {
  if (ownedIntents.has(effect)) throw new Error("night_effect_intent_already_owned");
  const effectiveTargetId = effect.target.id;
  const causeId = Symbol(
    `effect:${origin.day}:${origin.family}:${origin.stage}:${actorId}:${kind}:${origin.abilityId}:${origin.requestedTargetId}:${effectiveTargetId}`,
  );
  const captured = Object.freeze({
    ...origin,
    actorId,
    effectiveTargetId,
    causeId,
    sourceVersion: origin.actorLife.version,
    targetVersion: effect.target.version,
    sourceBody: origin.actorLife.life,
    targetBody: effect.target.life,
  });
  // 只锁定新增协议字段，不冻结原 target/callback；整个 origin 不能被重写绕过原体校验。
  Object.defineProperties(effect, {
    kind: { value: kind, enumerable: true },
    origin: { value: captured, enumerable: true },
  });
  ownedIntents.add(effect);
  return effect as T & Readonly<{ kind: K; origin: NightIntentOrigin }>;
}
/** 机械盾、额外刀与重复守失败保持各自类别及原 owner callback。 */
export function mechanicalNightIntent<K extends NightMechanicalIntentKind>(
  kind: K,
  effect: NightMechanicalEffect,
  origin: OriginInput & { readonly family: "mechanical" },
): NightMechanicalIntent<K> {
  return annotateIntent(effect, kind, origin, effect.actorId);
}
/** 觉醒效果不因已付瓶数或首次死亡而丢失原 callback 的专有规则。 */
export function awakenedNightIntent<K extends NightAwakenedIntentKind>(
  kind: K,
  effect: NightAwakenedEffect,
  origin: OriginInput & { readonly family: "awakened" },
): NightAwakenedIntent<K> {
  return annotateIntent(effect, kind, origin, effect.actorId);
}
/** 原毒与机械返回毒是不同链路；此 factory 只标记原已付毒。 */
export function originalPoisonIntent(
  effect: NightPoisonClaim,
  origin: OriginInput,
): NightOriginalPoisonIntent {
  return annotateIntent(effect, "original-poison", origin, effect.source.id);
}

/**
 * 在原 target 读取点消费新协议的类别/夜时点/因果链；不替代原 current 或生命重检。
 * 旧 claim/effect 完整保留原读取行为，包括额外 kind/origin getter 从不被调用。
 * 新协议错类别/夜时点属于约束强化；拒绝时不回滚先前已付库存或事实。
 */
export function nightIntentTarget(
  effect: { readonly target: NightLifeScope },
  expected: NightIntentKind,
  night?: () => number | undefined,
): NightLifeScope {
  if (ownedIntents.has(effect)) {
    const intent = effect as Readonly<{
      kind: NightIntentKind;
      origin: NightIntentOrigin;
      target: NightLifeScope;
    }>;
    if (intent.kind !== expected) throw new Error("night_effect_intent_kind_mismatch");
    const day = night?.();
    if (day !== undefined && intent.origin.day !== day)
      throw new Error("night_effect_intent_night_mismatch");
    if (
      !intent.origin.causeId ||
      intent.origin.actorLife.id !== intent.origin.actorId ||
      intent.origin.actorLife.version !== intent.origin.sourceVersion ||
      intent.origin.actorLife.life !== intent.origin.sourceBody
    )
      throw new Error("night_effect_intent_source_mismatch");
    const target = intent.target;
    if (
      target.id !== intent.origin.effectiveTargetId ||
      target.version !== intent.origin.targetVersion ||
      target.life !== intent.origin.targetBody
    )
      throw new Error("night_effect_intent_target_mismatch");
    return target;
  }
  return effect.target;
}

/** 仅在原毒 source 读取位置校验源句柄，不新增施毒者存活或窗口规则。 */
export function nightIntentPoisonSource(claim: NightPoisonClaim): NightLifeScope {
  const source = claim.source;
  if (ownedIntents.has(claim) && source !== (claim as NightOriginalPoisonIntent).origin.actorLife)
    throw new Error("night_effect_intent_source_mismatch");
  return source;
}

/** 在原反射 actorId 读取点核对来源，旧对象仍只执行一次同一属性读取。 */
export function nightIntentMechanicalActor(effect: NightMechanicalEffect): EntityId {
  const actorId = effect.actorId;
  if (ownedIntents.has(effect) && actorId !== (effect as NightMechanicalIntent).origin.actorId)
    throw new Error("night_effect_intent_source_mismatch");
  return actorId;
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
/** 原毒经折叠后的实际去向；反射改变目标，但保留原独立因果身份及原体链。 */
export interface NightPoisonRoute {
  readonly route: "direct" | "reflected";
  readonly origin: NightIntentOrigin;
  readonly targetId: EntityId;
  readonly target: NightLifeReadScope;
}
// 因果链属于本次伤害计划，而非另一份世界状态。非枚举 Symbol 保持原输出／归档形状。
const POISON_ROUTES = Symbol("night_poison_routes");
const NO_POISON_ROUTES: readonly NightPoisonRoute[] = Object.freeze([]);
// 只登记本 owner 的返回对象身份；外部 legacy plan／Proxy 不读取新增 Symbol。
// 路由数据仍仅存于同一计划，这个品牌不保存目标、库存或另一份世界状态。
const ownedDamagePlans = new WeakSet<object>();
export interface MechanicalDamagePlan {
  readonly shields: ReadonlySet<EntityId>;
  readonly directPoisonTargets: ReadonlySet<EntityId>;
  readonly reflectedPoisonTargets: ReadonlySet<EntityId>;
  readonly attacks: ReadonlySet<EntityId>;
  readonly failures: ReadonlySet<EntityId>;
  readonly reflections: readonly NightPoisonReflection[];
  readonly [POISON_ROUTES]?: readonly NightPoisonRoute[];
}
/** Wave／单目标结算的运行时输入；这里只读既有折叠结果，不重查资格或库存。 */
export function nightPoisonRoutes(plan: MechanicalDamagePlan): readonly NightPoisonRoute[] {
  return ownedDamagePlans.has(plan) ? (plan[POISON_ROUTES] ?? NO_POISON_ROUTES) : NO_POISON_ROUTES;
}
/** owned 路由参与毒的接受；旧集合仍含 owned 目标并作 OR 后备，尚未被路由完全替代。 */
export function nightPoisonRouteTargets(
  plan: MechanicalDamagePlan,
  targetId: EntityId,
  route: NightPoisonRoute["route"],
): boolean {
  return (
    nightPoisonRoutes(plan).some((cause) => cause.route === route && cause.targetId === targetId) ||
    (route === "direct" ? plan.directPoisonTargets : plan.reflectedPoisonTargets).has(targetId)
  );
}
function recordOwnedPoisonRoute(
  routes: NightPoisonRoute[],
  poison: NightPoisonClaim,
  route: NightPoisonRoute["route"],
  target: NightLifeScope,
  targetId: EntityId,
): void {
  if (ownedIntents.has(poison))
    routes.push(
      Object.freeze({
        route,
        origin: (poison as NightOriginalPoisonIntent).origin,
        targetId,
        target,
      }),
    );
}
/** 每份原毒只折叠一次；反射毒不再送回盾内，避免递归反射。 */
export function planMechanicalDamage(
  world: NightEffectQuery,
  effects: NightMechanicalEffects | undefined,
  poisons: readonly NightPoisonClaim[] = [],
  absorbedPoisonTargets: ReadonlySet<EntityId> = new Set(),
  intentNight?: () => number | undefined,
): MechanicalDamagePlan {
  // 有效盾按贡献顺序覆盖同一目标，反射事实使用最终选中盾的行动者。
  const shields = new Map<EntityId, NightMechanicalEffect>();
  for (const shield of effects?.shields ?? []) {
    if (
      shield.isCurrent() &&
      livingNightLife(world, nightIntentTarget(shield, "mechanical-shield", intentNight))
    ) {
      shields.set(nightIntentTarget(shield, "mechanical-shield", intentNight).id, shield);
    }
  }
  const directPoisonTargets = new Set<EntityId>();
  const reflectedPoisonTargets = new Set<EntityId>();
  const reflections: NightPoisonReflection[] = [];
  const poisonRoutes: NightPoisonRoute[] = [];
  // current 回调仅显式 false 撤销已付毒；直接毒不新增源存活门禁，反射才在原位置重检源生命。
  for (const poison of poisons) {
    if (
      poison.isCurrent?.() === false ||
      !livingNightLife(world, nightIntentTarget(poison, "original-poison", intentNight)) ||
      absorbedPoisonTargets.has(nightIntentTarget(poison, "original-poison", intentNight).id)
    )
      continue;
    const shield = shields.get(nightIntentTarget(poison, "original-poison", intentNight).id);
    if (!shield) {
      const target = nightIntentTarget(poison, "original-poison", intentNight),
        targetId = target.id;
      directPoisonTargets.add(targetId);
      recordOwnedPoisonRoute(poisonRoutes, poison, "direct", target, targetId);
      continue;
    }
    if (livingNightLife(world, nightIntentPoisonSource(poison))) {
      const target = nightIntentPoisonSource(poison),
        targetId = target.id;
      reflectedPoisonTargets.add(targetId);
      recordOwnedPoisonRoute(poisonRoutes, poison, "reflected", target, targetId);
      reflections.push({
        actorId: nightIntentMechanicalActor(shield),
        protectedTargetId: nightIntentTarget(poison, "original-poison", intentNight).id,
        casterId: nightIntentPoisonSource(poison).id,
      });
    }
  }
  const attacks = new Set<EntityId>();
  const failures = new Set<EntityId>();
  for (const attack of effects?.attacks ?? []) {
    if (
      attack.isCurrent() &&
      livingNightLife(world, nightIntentTarget(attack, "mechanical-attack", intentNight))
    )
      attacks.add(nightIntentTarget(attack, "mechanical-attack", intentNight).id);
  }
  for (const failure of effects?.failures ?? []) {
    if (
      failure.isCurrent() &&
      livingNightLife(world, nightIntentTarget(failure, "mechanical-failure", intentNight))
    )
      failures.add(nightIntentTarget(failure, "mechanical-failure", intentNight).id);
  }
  const plan: MechanicalDamagePlan = {
    shields: new Set(shields.keys()),
    directPoisonTargets,
    reflectedPoisonTargets,
    attacks,
    failures,
    reflections,
  };
  Object.defineProperty(plan, POISON_ROUTES, { value: Object.freeze(poisonRoutes) });
  ownedDamagePlans.add(plan);
  return plan;
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
