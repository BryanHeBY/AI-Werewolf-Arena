import { AliveComponent } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { RoleComponent } from "../../core/domain/components/role";
import { EntityId, GameEvent, type DeathSources, type DeathShotSelection } from "../../core/domain/model";
import { getDefaultHookRegistry, HookRegistry } from "../mechanisms";
import { World } from "../../core/domain/world";

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
  constructor(
    private readonly hookRegistry: HookRegistry = getDefaultHookRegistry(),
  ) {}

  /**
   * 处理放逐资格和免死，不提前写死亡或处理死亡警徽。
   */
  onVotedOut(world: World, targetId: EntityId, events: GameEvent[]): VotedOutResult {
    const handled = this.hookRegistry.onVotedOut(world, targetId, events);
    if (handled) {
      return handled;
    }

    const roleComp = world.getComponent<RoleComponent>(targetId, COMPONENT.Role);
    const aliveComp = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive);

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
    onHunterShoot: (hunterId: EntityId) => Promise<DeathShotSelection>,
    events: GameEvent[],
    commitAdditionalDeaths?: (result: DeathHookResult) => void,
  ): Promise<DeathHookResult> {
    return this.hookRegistry.onDeath(
      world,
      deadIds,
      deathSources,
      onHunterShoot,
      events,
      commitAdditionalDeaths,
    );
  }
}
