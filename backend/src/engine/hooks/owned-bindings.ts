/**
 * 负责内建死亡／放逐贡献的静态函数引用与私有资源绑定。
 * 输入为原内建函数、当次 World／事件容器及延迟准备读点；输出为本族命令或不含能力的空对象。
 * 静态登记只保存函数身份，不执行绑定，也不保存 World 或每局端口；同编号及复制函数不继承绑定。
 * 执行时点由引擎选择，实际调用时才构造查询与命令。关闭、取消及已付前缀由具体资源所有者负责，绑定异常原样传播。
 * 本内部模块不从公共入口导出；自定义扩展只能使用自身闭包显式持有的命令，不隐式继承内建绑定。
 */
import type { EntityId, GameEvent, Role, Camp, DeathShotSelection } from "../../domain/model";
import type { World } from "../../domain/world";
import type { DeathHook, VotedOutHook, CommittedDeathWaveHook } from "./registry";
import type { DeathShotEligibility } from "../../features/death-actions/death-shot-eligibility";

/** 仅引擎与可信资源owner间的私有构造输入，不进入hook运行上下文。 */
export interface OwnedHookBindingSource {
  readonly world: World;
  readonly events: GameEvent[];
  prepareWorld(): World;
  prepareEvents(): GameEvent[];
}
/** 完整选择只在本次可信资源绑定中传递；不进入公开callback参数。 */
export type OwnedDeathShotChooser = (
  actorId: EntityId,
  abilityId?: string,
  qualification?: DeathShotEligibility,
) => Promise<DeathShotSelection>;
export interface OwnedDeathHookBindingSource extends OwnedHookBindingSource {
  readonly chooseDeathShot: OwnedDeathShotChooser;
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
const deathBindings = new WeakMap<object, (source: OwnedDeathHookBindingSource) => object>();
const votedBindings = new WeakMap<object, Binder>();
const committedBindings = new WeakMap<object, Binder>();
/** 只有真实内部绑定可把本族继续点交给引擎；相同函数源码或返回形状不继承该身份。 */
export function hasOwnedDeathHookBinding(hook: object): boolean {
  return deathBindings.has(hook);
}
/** 内部静态登记不执行binder；默认Registry仍只持同一函数名单。 */
export function ownDeathHook<Ports extends object>(
  hook: DeathHook<Ports>,
  binder: (source: OwnedDeathHookBindingSource) => Ports,
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
  if (kind === "death") {
    const binder = deathBindings.get(hook);
    // 仅invokeDeathHook的可信装配进入此分支，完整chooser在该处作为必填字段构造。
    return binder ? binder(source as OwnedDeathHookBindingSource) : {};
  }
  const binder = (kind === "voted" ? votedBindings : committedBindings).get(hook);
  return binder ? binder(source) : {};
}

/** 三个实际提交形状，资源及政策仍由各owner的闭包持有。 */
export interface OwnedDeathCommands {
  resolve(
    ids: Parameters<DeathHook>[1],
    sources: Parameters<DeathHook>[2],
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
