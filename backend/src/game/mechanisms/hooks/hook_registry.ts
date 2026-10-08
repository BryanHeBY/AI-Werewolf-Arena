/** 文件说明：统一注册与执行投票/死亡相关机制钩子。 */
import { EntityId, GameEvent, type DeathSources, type DeathShotSelection } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { getDefaultRoleCatalog } from "../roles/catalog";
import type {NightLifeScope} from "../../../core/domain/night_effects";
import type {CharmBinding} from "../roles/wolf_beauty/relation";

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
  pendingShots?: Array<{targetScope:NightLifeScope;event:GameEvent}>;
  charmLinks?: Array<{binding:CharmBinding;nightEffect:boolean}>;
}
export interface DeathHookContext { deferShotCommit?: boolean; nightEffect: boolean; blocksNightShot(targetId: EntityId): boolean; blocksNightCharm?:(targetId:EntityId)=>boolean; eligibleDead?:ReadonlySet<EntityId>;isCurrent?:()=>boolean }

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
  deathSources: DeathSources,
  chooseDeathShot: (actorId: EntityId) => Promise<DeathShotSelection>,
  events: GameEvent[],
  context?: DeathHookContext,
) => Promise<DeathHookResult>;

function buildDefaultVotedOutHooks(): VotedOutHook[] {
  return getDefaultRoleCatalog()
    .all()
    .map((profile) => profile.votedOutHook)
    .filter((hook): hook is VotedOutHook => Boolean(hook));
}

function buildDefaultDeathHooks(): DeathHook[] {
  return getDefaultRoleCatalog()
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
    deathSources: DeathSources,
    chooseDeathShot: (actorId: EntityId) => Promise<DeathShotSelection>,
    events: GameEvent[],
    commitAdditionalDeaths?: (result: DeathHookResult) => void,
    context?: DeathHookContext,
  ): Promise<DeathHookResult> {
    const aggregated: DeathHookResult = {
      extraDeaths: [],
      extraDeathSources: {},
    };
    for (const hook of this.deathHooks) {
      if(context?.isCurrent&&!context.isCurrent())break;
      const result = await hook(world, deadIds, deathSources, chooseDeathShot, events, context);
      commitAdditionalDeaths?.(result);
      aggregated.extraDeaths.push(...result.extraDeaths);
      if (result.nightEffectTargets?.length) (aggregated.nightEffectTargets??=[]).push(...result.nightEffectTargets);
      if(result.pendingShots?.length)(aggregated.pendingShots??=[]).push(...result.pendingShots);
      if(result.charmLinks?.length)(aggregated.charmLinks??=[]).push(...result.charmLinks);
      for (const [id, marks] of Object.entries(result.extraDeathSources)) {
        aggregated.extraDeathSources[Number(id)] = [...new Set([...(aggregated.extraDeathSources[Number(id)] ?? []), ...marks])];
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
