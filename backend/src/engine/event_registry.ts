import { BadgeComponent } from "../domain/components/badge";
import { AliveComponent } from "../domain/components/alive";
import { COMPONENT } from "../domain/components/names";
import { RoleComponent } from "../domain/components/role";
import { EntityId, GameEvent, StatusMark } from "../domain/model";
import { getDefaultHookRegistry, HookRegistry } from "../mechanisms";
import { World } from "../domain/world";
import { transferOrDestroySheriffBadge } from "../mechanisms/sheriff/sheriff_badge";

/**
 * 放逐阶段处理结果。
 */
export type VotedOutResult = import("../mechanisms").VotedOutResult;

/**
 * 死亡钩子处理结果（含追加死亡）。
 */
export type DeathHookResult = import("../mechanisms").DeathHookResult;

/**
 * 事件总线拦截器：
 * - onVotedOut: 处理白痴翻牌免死与警徽销毁。
 * - onDeath: 处理猎人是否可开枪、开枪造成的追加死亡。
 */
export class EventRegistry {
  constructor(
    private readonly hookRegistry: HookRegistry = getDefaultHookRegistry(),
  ) {}

  /**
   * 处理放逐事件：包含白痴翻牌免死与警徽处理分支。
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

    const badge = world.getComponent<BadgeComponent>(targetId, COMPONENT.Badge);
    if (badge?.isSheriff) {
      transferOrDestroySheriffBadge(world, targetId, "voted_out", events);
    }

    aliveComp.alive = false;
    return {
      prevented: false,
      removed: [targetId],
      reason: "normal_voted_out",
    };
  }

  async onDeath(
    world: World,
    deadIds: EntityId[],
    deathSources: Record<number, StatusMark[]>,
    onHunterShoot: (hunterId: EntityId) => Promise<EntityId | null>,
    events: GameEvent[],
  ): Promise<DeathHookResult> {
    return this.hookRegistry.onDeath(
      world,
      deadIds,
      deathSources,
      onHunterShoot,
      events,
    );
  }
}
