/** 文件说明：统一注册与执行投票/死亡相关机制钩子。 */
import { EntityId, GameEvent, StatusMark } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { getDefaultRoleProfileRegistry } from "../roles/profile_registry";

/** 放逐钩子返回结果。 */
export interface VotedOutResult {
  prevented: boolean;
  removed: EntityId[];
  reason: string;
}

/** 死亡钩子聚合结果。 */
export interface DeathHookResult {
  extraDeaths: EntityId[];
  extraDeathSources: Record<number, StatusMark[]>;
}

/** 放逐钩子函数签名。 */
export type VotedOutHook = (
  world: World,
  targetId: EntityId,
  events: GameEvent[],
) => VotedOutResult | null;

/** 死亡钩子函数签名。 */
export type DeathHook = (
  world: World,
  deadIds: EntityId[],
  deathSources: Record<number, StatusMark[]>,
  onHunterShoot: (hunterId: EntityId) => Promise<EntityId | null>,
  events: GameEvent[],
) => Promise<DeathHookResult>;

function buildDefaultVotedOutHooks(): VotedOutHook[] {
  return getDefaultRoleProfileRegistry()
    .all()
    .map((profile) => profile.votedOutHook)
    .filter((hook): hook is VotedOutHook => Boolean(hook));
}

function buildDefaultDeathHooks(): DeathHook[] {
  return getDefaultRoleProfileRegistry()
    .all()
    .map((profile) => profile.deathHook)
    .filter((hook): hook is DeathHook => Boolean(hook));
}

/** 钩子注册表：负责分发放逐钩子与死亡钩子。 */
export class HookRegistry {
  constructor(
    private readonly votedOutHooks: VotedOutHook[] = buildDefaultVotedOutHooks(),
    private readonly deathHooks: DeathHook[] = buildDefaultDeathHooks(),
  ) {}

  onVotedOut(
    world: World,
    targetId: EntityId,
    events: GameEvent[],
  ): VotedOutResult | null {
    for (const hook of this.votedOutHooks) {
      const result = hook(world, targetId, events);
      if (result) {
        return result;
      }
    }
    return null;
  }

  async onDeath(
    world: World,
    deadIds: EntityId[],
    deathSources: Record<number, StatusMark[]>,
    onHunterShoot: (hunterId: EntityId) => Promise<EntityId | null>,
    events: GameEvent[],
  ): Promise<DeathHookResult> {
    const aggregated: DeathHookResult = {
      extraDeaths: [],
      extraDeathSources: {},
    };
    for (const hook of this.deathHooks) {
      const result = await hook(world, deadIds, deathSources, onHunterShoot, events);
      aggregated.extraDeaths.push(...result.extraDeaths);
      for (const [id, marks] of Object.entries(result.extraDeathSources)) {
        aggregated.extraDeathSources[Number(id)] = marks;
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
