/** 文件说明：遗言规则与事件写入机制。 */
import { AliveComponent } from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import {
  EntityId,
  GameEvent,
  Phase,
  DeathCause,
  type DeathSources,
} from "../../../core/domain/model";
import { World } from "../../../core/domain/world";

/** 遗言机制：判定是否可遗言并写入遗言授权事件。 */
export class LastWordsMechanism {
  shouldGrantLastWords(deathPhase: Phase, day: number, sources: readonly DeathCause[]): boolean {
    if (
      sources.length === 0 ||
      sources.includes(DeathCause.SelfDestruct) ||
      sources.includes(DeathCause.WhiteWolfBlast)
    )
      return false;
    if (deathPhase === Phase.Day && sources.every((source) => source === DeathCause.DuelFailure))
      return true;
    return (
      (deathPhase === Phase.Night &&
        day === 1 &&
        sources.some(
          (source) =>
            source === DeathCause.WolfKill ||
            source === DeathCause.AwakenedHiddenKnife ||
            source === DeathCause.Poison ||
            source === DeathCause.Dream ||
            source === DeathCause.MerchantBacklash ||
            source === DeathCause.BlackMarketBacklash,
        )) ||
      (deathPhase === Phase.Voting && sources.includes(DeathCause.Exile))
    );
  }

  recordLastWordsGranted(
    world: World,
    deadIds: EntityId[],
    deathPhase: Phase,
    lastWordsPhase: Phase,
    day: number,
    events: GameEvent[],
    sources: DeathSources,
    deathPhases: Readonly<Record<EntityId, Phase>> = {},
  ): void {
    for (const deadId of deadIds) {
      if (
        !this.shouldGrantLastWords(deathPhases[deadId] ?? deathPhase, day, sources[deadId] ?? [])
      ) {
        continue;
      }
      const alive = world.getComponent<AliveComponent>(deadId, COMPONENT.Alive);
      if (!alive || alive.alive) {
        continue;
      }
      events.push({
        timestamp: Date.now(),
        type: "last_words_granted",
        payload: {
          playerId: deadId,
          phase: lastWordsPhase,
          day,
        },
      });
    }
  }
}

let defaultMechanism: LastWordsMechanism | null = null;

/** 获取默认遗言机制实例。 */
export function getDefaultLastWordsMechanism(): LastWordsMechanism {
  if (!defaultMechanism) {
    defaultMechanism = new LastWordsMechanism();
  }
  return defaultMechanism;
}
