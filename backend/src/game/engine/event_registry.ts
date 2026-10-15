/**
 * 负责分发放逐、已提交整波与死亡动作的真实机制贡献。
 * 输入为原 World、名单／原因、日期／阶段及角色动作上下文；输出保留免死替换或追加死亡提案。
 * 整波扩展在实际 Alive 提交后、梦记录／遗言前同步运行；分发器不标死、改阶段或回滚事实。
 */
import { AliveComponent } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import {
  EntityId,
  GameEvent,
  type DeathSources,
  type DeathShotSelection,
  type Phase,
} from "../../domain/model";
import { getDefaultHookRegistry, HookRegistry } from "../mechanisms";
import { World } from "../../domain/world";
import {
  createCommittedDeathWaveContributions,
  type CommittedDeathWaveHook,
} from "../mechanisms/hooks/hook_registry";

/**
 * 放逐阶段处理结果。
 */
export type VotedOutResult = import("../mechanisms").VotedOutResult;

/**
 * 死亡钩子处理结果（含追加死亡）。
 */
export type DeathHookResult = import("../mechanisms").DeathHookResult;

/**
 * 角色钩子分发入口：
 * - onVotedOut: 处理翻牌免死或返回待死亡名单。
 * - onDeath: 返回追加死亡提案；DeathResolution 写入死亡状态。
 */
export class EventRegistry {
  // 此列表只装配必需的整波贡献，不让旧注入的放逐／晚死亡 hooks 替换野孩子榜样结算。
  // 列表持有原函数引用，不持有第二份角色状态或生命账本。
  private readonly committedDeathWaveHooks: readonly CommittedDeathWaveHook[] =
    createCommittedDeathWaveContributions();
  constructor(private readonly hookRegistry: HookRegistry = getDefaultHookRegistry()) {}

  /** 只消费已经提交的原整波，首异常原样传播；不合并到后面的异步枪／死亡钩子。 */
  onCommittedDeathWave(
    world: World,
    deadIds: readonly EntityId[],
    deathSources: DeathSources,
    day: number,
    phase: Phase,
    events: GameEvent[],
  ): void {
    for (const hook of this.committedDeathWaveHooks)
      hook(world, deadIds, deathSources, day, phase, events);
  }

  /**
   * 处理放逐资格和免死，不提前写死亡或处理死亡警徽。
   */
  onVotedOut(world: World, targetId: EntityId, events: GameEvent[]): VotedOutResult {
    const handled = this.hookRegistry.onVotedOut(world, targetId, events);
    if (handled) {
      return handled;
    }

    const roleComp = world.getComponent(targetId, COMPONENT.Role);
    const aliveComp = world.getComponent(targetId, COMPONENT.Alive);

    if (!roleComp || !aliveComp || !aliveComp.alive) {
      return { prevented: false, removed: [], reason: "invalid_target" };
    }

    return {
      prevented: false,
      removed: [targetId],
      reason: "normal_voted_out",
    };
  }

  async onDeath(
    world: World,
    deadIds: EntityId[],
    deathSources: DeathSources,
    chooseDeathShot: (actorId: EntityId, abilityId?: string) => Promise<DeathShotSelection>,
    events: GameEvent[],
    commitAdditionalDeaths?: (result: DeathHookResult) => void,
    context?: import("../mechanisms/hooks/hook_registry").DeathHookContext,
  ): Promise<DeathHookResult> {
    return this.hookRegistry.onDeath(
      world,
      deadIds,
      deathSources,
      chooseDeathShot,
      events,
      commitAdditionalDeaths,
      context,
    );
  }
}
