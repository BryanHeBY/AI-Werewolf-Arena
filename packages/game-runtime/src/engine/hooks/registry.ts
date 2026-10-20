/**
 * 负责原放逐／死亡动作分发，以及独立于可替换晚 hook 的必需整波贡献装配。
 * 输入为原 World、原名单／原因、日期／阶段和事件；输出保留免死结果或额外死亡提案。
 * 已提交整波贡献在实际标死之后、梦记录及遗言之前同步执行；榜样首次死亡由野孩子唯一绑定 owner 提交。
 * 这里不修改 Alive、选择阶段或回滚贡献已写事实；首失败原样传播，停止后续贡献并保留已付／已提交前缀。
 */
import {
  EntityId,
  GameEvent,
  type DeathSources,
  type Phase,
  type DeathShotSelection,
} from "../../domain/model";
import { types } from "node:util";
import { World } from "../../domain/world";
import { COMPONENT } from "../../domain/components/names";
import {
  ownedHookPorts,
  hasOwnedDeathHookBinding,
  ownCommittedDeathHook,
  type HookRuntime,
  type OwnedHookBindingSource,
  type OwnedDeathHookBindingSource,
  type OwnedDeathShotChooser,
  type OwnedCommittedCommands,
} from "./owned-bindings";
import { getDefaultRoleCatalog } from "../../rulesets/roles/role-catalog-assembly";
import type { NightLifeScope } from "../../domain/night-effects";
import type { DeathWaveContribution } from "../death-wave-contribution";
import type { PaidPatrolProposal } from "../../features/awakened-hunter/ports";
import { giftGunDeathHook } from "../../features/death-actions/gift-hook-ports";
import { resolveWildChildDeathWave } from "../../features/wild-child/ports";
import {
  hasDeathActionContinuation,
  type DeathActionContinuation,
} from "./death-action-continuation";

/** 已完成本批 Alive 提交后的具名扩展时点；不是可追加死亡或选择枪的晚 deathHook。 */
export type CommittedDeathWaveHook<Ports extends object = Record<never, never>> = {
  invoke(
    runtime: HookRuntime<Ports>,
    deadIds: readonly EntityId[],
    deathSources: DeathSources,
    day: number,
    phase: Phase,
  ): void;
}["invoke"];

// 冷绑定只登记此同一函数；默认列表仍为静态装配，不按World缓存或每次构造新hook。
const wildChildCommittedDeathHook = ownCommittedDeathHook<OwnedCommittedCommands>(
  (runtime, deadIds, deathSources, day, phase) =>
    runtime.ports.resolve(deadIds, deathSources, day, phase),
  (source) => ({
    resolve: (
      deadIds: readonly EntityId[],
      deathSources: DeathSources,
      day: number,
      phase: Phase,
    ) => resolveWildChildDeathWave(source.world, deadIds, deathSources, day, phase, source.events),
  }),
);

/** 真实必需整波贡献装配；不属于调用方可替换的 votedOut／晚 deathHook 列表。 */
export function createCommittedDeathWaveContributions(): readonly CommittedDeathWaveHook[] {
  return [wildChildCommittedDeathHook];
}

/** 放逐钩子返回结果。 */
export interface VotedOutResult {
  prevented: boolean;
  removed: EntityId[];
  reason: string;
}

/** 死亡钩子聚合结果。 */
export interface DeathHookResult {
  extraDeaths: EntityId[];
  extraDeathSources: DeathSources;
  nightEffectTargets?: EntityId[];
  pendingShots?: Array<{
    targetScope: NightLifeScope;
    event: GameEvent;
    isCurrent?: () => boolean;
  }>;
  /** 每 hook 同步消费的本族运行贡献；具体绑定／回执不属于通用结果。 */
  deathWaveContributions?: DeathWaveContribution[];
  /** 仅内部 owned hook 的单次继续标记；原程序及提交写权都不属于公开结果数据。 */
  deathActionContinuations?: readonly DeathActionContinuation[];
  /** 只接受本族付款后mint的内存提案；JSON来源不能授予巡猎或夜根抑制。 */
  pendingPatrols?: readonly PaidPatrolProposal[];
}
export interface DeathHookContext {
  readonly deathOriginPhase?: Phase;
  nativeHunterShotTargets?: ReadonlySet<EntityId>;
  day?: number;
  deferShotCommit?: boolean;
  nightEffect: boolean;
  blocksNightShot(targetId: EntityId): boolean;
  blocksNightCharm?: (targetId: EntityId) => boolean;
  eligibleDead?: ReadonlySet<EntityId>;
  isCurrent?: () => boolean;
}

/** 放逐钩子函数签名。 */
export type VotedOutHook<Ports extends object = Record<never, never>> = {
  invoke(runtime: HookRuntime<Ports>, targetId: EntityId): VotedOutResult | null;
}["invoke"];

/** 公共扩展只能观察选择标量；该副本不是目标生命、映射回调、许可或付款回执。 */
export type DeathHookChoice =
  | { kind: "shot"; targetId: EntityId; deathActionId: number; mappedMiss?: true }
  | { kind: "pass"; deathActionId: number }
  | { kind: "invalid" };
export type DeathHookChooser = (actorId: EntityId, abilityId?: string) => Promise<DeathHookChoice>;

/** 死亡钩子函数签名。 */
export type DeathHook<Ports extends object = Record<never, never>> = {
  invoke(
    runtime: HookRuntime<Ports>,
    deadIds: EntityId[],
    deathSources: DeathSources,
    chooseDeathShot: DeathHookChooser,
    context?: DeathHookContext,
  ): Promise<DeathHookResult>;
}["invoke"];

/** 回调实际获得新query对象；原World只留本调用的私有闭包，不从返回值取回。 */
function hookRuntime(
  kind: "death" | "voted" | "committed",
  hook: object,
  source: OwnedHookBindingSource,
): HookRuntime {
  return {
    queries: {
      role: (id) => source.world.getComponent(id, COMPONENT.Role)?.role,
      camp: (id) => source.world.getComponent(id, COMPONENT.Camp)?.camp,
      alive: (id) => source.world.getComponent(id, COMPONENT.Alive)?.alive === true,
      entityIds: () => source.world.entityIds(),
    },
    ports: ownedHookPorts(kind, hook, source),
  };
}
/** 可信调用方才提供原World/事件；晚prepare源不传给动态hook或其返回对象。 */
export interface DeathHookPreparationSource {
  world(): World;
  events(): GameEvent[];
  chooseDeathPatrol?: OwnedDeathHookBindingSource["chooseDeathPatrol"];
}
function bindingSource(
  world: World,
  events: GameEvent[],
  preparation?: DeathHookPreparationSource,
): OwnedHookBindingSource {
  return {
    world,
    events,
    prepareWorld: () => (preparation ? preparation.world() : world),
    prepareEvents: () => (preparation ? preparation.events() : events),
  };
}
/** 真实一次调用端口，也供显式owner测试；未知custom只有query；需要具体command的调用方在自有闭包中显式绑定，不收通用World容器。 */
export function invokeDeathHook(
  hook: DeathHook,
  world: World,
  ids: EntityId[],
  sources: DeathSources,
  choose: OwnedDeathShotChooser,
  events: GameEvent[],
  context?: DeathHookContext,
  preparation?: DeathHookPreparationSource,
): Promise<DeathHookResult> {
  // 具名新端口只取真实自有data字段；旧扩展的同名访问器不因新增能力被执行。
  const patrolChooser =
    preparation && !types.isProxy(preparation)
      ? Object.getOwnPropertyDescriptor(preparation, "chooseDeathPatrol")?.value
      : undefined;
  const source: OwnedDeathHookBindingSource = {
    ...bindingSource(world, events, preparation),
    chooseDeathShot: choose,
    ...(typeof patrolChooser === "function" ? { chooseDeathPatrol: patrolChooser } : {}),
  };
  // 未知扩展实际取得新标量对象，不透传原targetScope/life或mappingCurrent。
  // 内建资源command不调用此adapter，仍私用同一原chooser及其完整原体／映射结果。
  const publicChoose: DeathHookChooser = async (actorId, abilityId) => {
    // 显式只传公共两个标量，JS 的额外实参也不能注入可信 owner 的资格闭包。
    const selection = await choose(actorId, abilityId);
    if (selection.kind === "shot")
      return {
        kind: "shot",
        targetId: selection.targetId,
        deathActionId: selection.deathActionId,
        ...(selection.mappedMiss ? { mappedMiss: true as const } : {}),
      };
    if (selection.kind === "pass") return { kind: "pass", deathActionId: selection.deathActionId };
    return { kind: "invalid" };
  };
  return hook(hookRuntime("death", hook, source), ids, sources, publicChoose, context);
}
export function invokeVotedOutHook(
  hook: VotedOutHook,
  world: World,
  targetId: EntityId,
  events: GameEvent[],
): VotedOutResult | null {
  return hook(hookRuntime("voted", hook, bindingSource(world, events)), targetId);
}
export function invokeCommittedDeathWaveHook(
  hook: CommittedDeathWaveHook,
  world: World,
  ids: readonly EntityId[],
  sources: DeathSources,
  day: number,
  phase: Phase,
  events: GameEvent[],
): void {
  hook(hookRuntime("committed", hook, bindingSource(world, events)), ids, sources, day, phase);
}

function buildDefaultVotedOutHooks(): VotedOutHook[] {
  return getDefaultRoleCatalog()
    .allRuntime()
    .map(({ runtime }) => runtime.votedOutHook)
    .filter((hook): hook is VotedOutHook => Boolean(hook));
}

function buildDefaultDeathHooks(): DeathHook[] {
  return getDefaultRoleCatalog()
    .allRuntime()
    .map(({ runtime }) => runtime.deathHook)
    .filter((hook): hook is DeathHook => Boolean(hook))
    .concat(giftGunDeathHook);
}

/** 钩子注册表：负责分发放逐钩子与死亡钩子。 */
export class HookRegistry {
  constructor(
    private readonly votedOutHooks: VotedOutHook[] = buildDefaultVotedOutHooks(),
    private readonly deathHooks: DeathHook[] = buildDefaultDeathHooks(),
  ) {}

  onVotedOut(world: World, targetId: EntityId, events: GameEvent[]): VotedOutResult | null {
    for (const hook of this.votedOutHooks) {
      const result = invokeVotedOutHook(hook, world, targetId, events);
      if (result) {
        return result;
      }
    }
    return null;
  }

  async onDeath(
    world: World,
    deadIds: EntityId[],
    deathSources: DeathSources,
    chooseDeathShot: OwnedDeathShotChooser,
    events: GameEvent[],
    commitAdditionalDeaths?: (
      result: DeathHookResult,
      capturedContinuations?: readonly DeathActionContinuation[] | null,
    ) => void,
    context?: DeathHookContext,
    preparation?: DeathHookPreparationSource,
  ): Promise<DeathHookResult> {
    const aggregated: DeathHookResult = {
      extraDeaths: [],
      extraDeathSources: {},
    };
    for (const hook of this.deathHooks) {
      if (context?.isCurrent && !context.isCurrent()) break;
      const result = await invokeDeathHook(
        hook,
        world,
        deadIds,
        deathSources,
        chooseDeathShot,
        events,
        context,
        preparation,
      );
      // 单次读取并固定继续项；显示 getter 或原数组后续替换不能绕过 owned 身份判断。
      const continuations = result.deathActionContinuations;
      const patrols = result.pendingPatrols;
      if (patrols !== undefined && !hasOwnedDeathHookBinding(hook))
        throw new Error("awakened_patrol_unowned_hook");
      if (continuations !== undefined) {
        if (!hasOwnedDeathHookBinding(hook))
          throw new Error("death_action_continuation_unowned_hook");
        if (!Array.isArray(continuations) || !continuations.every(hasDeathActionContinuation))
          throw new Error("death_action_continuation_invalid");
      }
      // 不展开原结果：合法原型 getter、不可枚举字段、receiver 与原回调对象身份都保持。
      const captured = continuations === undefined ? null : [...continuations];
      commitAdditionalDeaths?.(result, captured);
      aggregated.extraDeaths.push(...result.extraDeaths);
      if (result.nightEffectTargets?.length)
        (aggregated.nightEffectTargets ??= []).push(...result.nightEffectTargets);
      if (result.pendingShots?.length)
        (aggregated.pendingShots ??= []).push(...result.pendingShots);
      if (patrols?.length)
        aggregated.pendingPatrols = [...(aggregated.pendingPatrols ?? []), ...patrols];
      if (result.deathWaveContributions?.length)
        (aggregated.deathWaveContributions ??= []).push(...result.deathWaveContributions);
      if (captured?.length)
        aggregated.deathActionContinuations = [
          ...(aggregated.deathActionContinuations ?? []),
          ...captured,
        ];
      for (const [id, marks] of Object.entries(result.extraDeathSources)) {
        aggregated.extraDeathSources[Number(id)] = [
          ...new Set([...(aggregated.extraDeathSources[Number(id)] ?? []), ...marks]),
        ];
      }
    }
    return aggregated;
  }
}

let defaultRegistry: HookRegistry | null = null;

/** 获取默认钩子注册表实例。 */
export function getDefaultHookRegistry(): HookRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new HookRegistry();
  }
  return defaultRegistry;
}
