import { EntityId, GameEvent, StatusMark } from "../../domain/model";
import { World } from "../../domain/world";
import { hunterDeathHook } from "../roles/hunter/death_hook";
import { idiotVotedOutHook } from "../roles/idiot/voted_out_hook";

export interface VotedOutResult {
  prevented: boolean;
  removed: EntityId[];
  reason: string;
}

export interface DeathHookResult {
  extraDeaths: EntityId[];
  extraDeathSources: Record<number, StatusMark[]>;
}

type VotedOutHook = (
  world: World,
  targetId: EntityId,
  events: GameEvent[],
) => VotedOutResult | null;

type DeathHook = (
  world: World,
  deadIds: EntityId[],
  deathSources: Record<number, StatusMark[]>,
  onHunterShoot: (hunterId: EntityId) => Promise<EntityId | null>,
  events: GameEvent[],
) => Promise<DeathHookResult>;

const defaultVotedOutHooks: VotedOutHook[] = [idiotVotedOutHook];
const defaultDeathHooks: DeathHook[] = [hunterDeathHook];

export class HookRegistry {
  constructor(
    private readonly votedOutHooks: VotedOutHook[] = defaultVotedOutHooks,
    private readonly deathHooks: DeathHook[] = defaultDeathHooks,
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

