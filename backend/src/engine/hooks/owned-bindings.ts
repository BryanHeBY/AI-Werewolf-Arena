/**
 * 负责内建死亡／放逐贡献的静态函数引用与私有资源绑定。
 * 这里只登记受信资源owner的cold binder；映射不保存World或每局端口，克隆/同id函数不继承绑定。
 * 引擎在实际调用时给binder原参数及晚prepare读取源，扩展只收到新建query/具体command对象。
 * 本内部装配叶不经公共barrel导出；自定义扩展可在闭包显式持有调用方本来拥有的窄command，不隐式继承内建绑定。
 */
import type { EntityId, GameEvent, Role, Camp } from "../../domain/model";
import type { World } from "../../domain/world";
import type { DeathHook, VotedOutHook, CommittedDeathWaveHook } from "./registry";

/** 仅引擎与可信资源owner间的私有构造输入，不进入hook运行上下文。 */
export interface OwnedHookBindingSource {
  readonly world: World;
  readonly events: GameEvent[];
  prepareWorld(): World;
  prepareEvents(): GameEvent[];
}
export interface HookQueries {
  role(id: EntityId): Role | undefined;
  camp(id: EntityId): Camp | undefined;
  alive(id: EntityId): boolean;
  entityIds(): EntityId[];
}
export interface HookRuntime<Ports extends object = Record<never, never>> {
  readonly queries: HookQueries;
  readonly ports: Ports;
}
type Binder = (source: OwnedHookBindingSource) => object;
const deathBindings = new WeakMap<object, Binder>();
const votedBindings = new WeakMap<object, Binder>();
const committedBindings = new WeakMap<object, Binder>();
/** 内部静态登记不执行binder；默认Registry仍只持同一函数名单。 */
export function ownDeathHook<Ports extends object>(
  hook: DeathHook<Ports>,
  binder: (source: OwnedHookBindingSource) => Ports,
): DeathHook<Ports> {
  deathBindings.set(hook, binder);
  return hook;
}
export function ownVotedOutHook<Ports extends object>(
  hook: VotedOutHook<Ports>,
  binder: (source: OwnedHookBindingSource) => Ports,
): VotedOutHook<Ports> {
  votedBindings.set(hook, binder);
  return hook;
}
export function ownCommittedDeathHook<Ports extends object>(
  hook: CommittedDeathWaveHook<Ports>,
  binder: (source: OwnedHookBindingSource) => Ports,
): CommittedDeathWaveHook<Ports> {
  committedBindings.set(hook, binder);
  return hook;
}
export function ownedHookPorts(
  kind: "death" | "voted" | "committed",
  hook: object,
  source: OwnedHookBindingSource,
): object {
  const binder = (
    kind === "death" ? deathBindings : kind === "voted" ? votedBindings : committedBindings
  ).get(hook);
  return binder ? binder(source) : {};
}

/** 三个实际提交形状，资源及政策仍由各owner的闭包持有。 */
export interface OwnedDeathCommands {
  resolve(
    ids: Parameters<DeathHook>[1],
    sources: Parameters<DeathHook>[2],
    choose: Parameters<DeathHook>[3],
    context: Parameters<DeathHook>[4],
  ): ReturnType<DeathHook>;
}
export interface OwnedVotedOutCommands {
  resolve(targetId: number): ReturnType<VotedOutHook>;
}
export interface OwnedCommittedCommands {
  resolve(
    ids: readonly EntityId[],
    sources: Parameters<CommittedDeathWaveHook>[2],
    day: number,
    phase: Parameters<CommittedDeathWaveHook>[4],
  ): void;
}
