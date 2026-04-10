import { EntityId, GameEvent, StatusMark } from "../../domain/model";
import { World } from "../../domain/world";
import { getDefaultRoleProfileRegistry } from "../roles/profile_registry";

export interface VotedOutResult {
  prevented: boolean;
  removed: EntityId[];
  reason: string;
}

export interface DeathHookResult {
  extraDeaths: EntityId[];
  extraDeathSources: Record<number, StatusMark[]>;
}

export type VotedOutHook = (
  world: World,
  targetId: EntityId,
  events: GameEvent[],
) => VotedOutResult | null;

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

export function getDefaultHookRegistry(): HookRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new HookRegistry();
  }
  return defaultRegistry;
}
