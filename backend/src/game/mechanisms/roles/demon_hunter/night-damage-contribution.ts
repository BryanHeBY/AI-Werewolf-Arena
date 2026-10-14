/**
 * 负责猎魔夜间来源的原地折叠及最终上帝事实发布，输入为已封存来源、原字典／名单和晚查询。
 * 输出仍写入调用方的同一来源与守护覆盖数组；事实只在最终来源检查之后发布。
 * 原体资格、用药付款和不可复用 proof 归原生控制器／权威，本模块不标死、推进时钟或重验许可。
 * 同步读写顺序与失败前缀保留；已有毒覆盖、守护记录或事件写入不会因后续失败回滚。
 */
import { DeathCause, Phase, type DeathSources, type EntityId, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { DEMON_HUNTER_POLICY } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import type { DeliveredDemonNightSources } from "./native_potion_controller";

/** 原流水线捕获的五字段视图；当前守护查询与保护标志不是新的库存或行动许可。 */
export type DemonKnifeProtection = Readonly<{
  targetId: number;
  wolf: boolean;
  guard: boolean;
  guardCurrent?: () => boolean;
  heal: boolean;
}>;

/**
 * 只读取原保护、救药 mark 与狼刀来源；惰性目标使实际 callee／receiver 查找先于目标 getter。
 * knifeProtection 保留两次现场读取；不接收可写 World、不复制来源或提前生成观察快照。
 */
export interface DemonNightDamageQueries {
  readonly knifeProtection: DemonKnifeProtection | undefined;
  healMarkPresent(target: () => EntityId): boolean;
  wolfSourceCurrent(target: () => EntityId): boolean | undefined;
}

/** 在夜仆到期与原生命筛选之前折叠；来源字典、每次覆盖和 guardOverrides 引用都归调用方。 */
export function appendDemonNightDamageSources(
  queries: DemonNightDamageQueries,
  demon: Readonly<DeliveredDemonNightSources>,
  proposedSources: DeathSources,
  guardOverrides: Array<{ targetId: number; guard: boolean }>,
): void {
  // 只替换原生控制器已给出的毒覆盖；独立、未知的毒来源仍由该控制器的原覆盖结果决定。
  for (const override of demon.poisonOverrides) {
    const causes: DeathCause[] = (proposedSources[override.targetId] ?? []).filter(
      (cause) => cause !== DeathCause.Poison,
    );
    if (override.poison) causes.push(DeathCause.Poison);
    proposedSources[override.targetId] = causes;
  }
  if (queries.knifeProtection) {
    const knife = queries.knifeProtection;
    const guard = knife.guardCurrent?.() ?? knife.guard;
    // 守护记录先写；后续救药查找／mark getter 失败时，保留此前毒覆盖与这条记录。
    guardOverrides.push({ targetId: knife.targetId, guard });
    const heal =
      demon.healOverrides.find((effect) => effect.targetId === knife.targetId)?.heal ??
      (knife.heal || queries.healMarkPresent(() => knife.targetId));
    const causes = (proposedSources[knife.targetId] ?? []).filter(
      (cause) => cause !== DeathCause.WolfKill,
    ) as DeathCause[];
    // 普通守／救同时生效仍按原碰撞规则致死；当前狼刀查询只在前两个条件满足后运行。
    if (knife.wolf && guard === heal && queries.wolfSourceCurrent(() => knife.targetId))
      causes.push(DeathCause.WolfKill);
    proposedSources[knife.targetId] = causes;
  }
  if (demon.hunt.damage) {
    const { targetId, cause } = demon.hunt.damage;
    const causes = (proposedSources[targetId] ??= []);
    causes.push(
      cause === "demon_hunt" ? DeathCause.DemonHunt : DeathCause.DemonHuntBacklash,
    );
  }
}

/** 只提供晚读的原事件数组；不拥有生命、阶段或来源资格。 */
export interface DemonNightDamagePublicationRuntime {
  readonly events: GameEvent[];
}

/** 夜仆收尾、原生命／来源筛选及秘密之身折叠之后发布；取消事实、免疫事实、可选诊断依次执行。 */
export function publishDemonNightDamageSources(
  runtime: DemonNightDamagePublicationRuntime,
  demon: Readonly<DeliveredDemonNightSources>,
  nightDay: number,
  guardOverrides: Array<{ targetId: number; guard: boolean }>,
  deaths: EntityId[],
  sources: DeathSources,
): void {
  if (demon.hunt.cancelled)
    runtime.events.push({
      timestamp: Date.now(),
      type: "demon_hunter_cancelled",
      payload: { ...demon.hunt.cancelled },
      audience: Object.freeze([]),
    });
  for (const fact of demon.poisonImmunities)
    runtime.events.push({
      timestamp: Date.now(),
      type: "demon_hunter_poison_immune",
      payload: { ...fact },
      audience: Object.freeze([]),
    });
  // 事件失败原样传播；诊断是原可选记录，不吞事件错误、不升格为必需录制。
  safeRecordLogicOp({
    scope: "resolution",
    op: "demon_hunter_sources_frozen",
    phase: Phase.Night,
    status: "ok",
    output: {
      policy: DEMON_HUNTER_POLICY,
      day: nightDay,
      hunt: demon.hunt,
      poison_immunities: demon.poisonImmunities,
      poison_overrides: demon.poisonOverrides,
      heal_overrides: demon.healOverrides,
      guard_overrides: guardOverrides,
      deaths: [...deaths],
      death_sources: sources,
    },
  });
}
