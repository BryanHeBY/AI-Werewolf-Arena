/** 文件说明：遗言规则与事件写入机制。 */
import { AliveComponent } from "../../domain/components/alive";
import { COMPONENT } from "../../domain/components/names";
import { EntityId, GameEvent, Phase } from "../../domain/model";
import { World } from "../../domain/world";

/** 遗言机制：判定是否可遗言并写入遗言授权事件。 */
export class LastWordsMechanism {
  shouldGrantLastWords(phase: Phase, day: number): boolean {
    return (phase === Phase.Night && day === 1) || phase === Phase.Voting;
  }

  recordLastWordsGranted(
    world: World,
    deadIds: EntityId[],
    phase: Phase,
    day: number,
    events: GameEvent[],
  ): void {
    for (const deadId of deadIds) {
      if (!this.shouldGrantLastWords(phase, day)) {
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
          phase,
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
