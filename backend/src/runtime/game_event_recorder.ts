import type { World } from "../core/domain/world";
import type { GameEvent } from "../core";
import { COMPONENT, RoleComponent } from "../core";
import { buildAgentVisibleEvent } from "../game/engine/agent_visible_event_feed";
import { getDefaultScriptEventRenderRegistry } from "../game";
import type { SessionRecordManager } from "../recording/session_recorder";

export interface GameEventRecorderOptions {
  world: World;
  replayManager: SessionRecordManager;
}

export class GameEventRecorder {
  private recordedEventIndex = 0;
  private readonly playerVisibleEventSeq = new Map<number, number>();
  private replayDayCursor = 1;
  private replayPhaseCursor: string;

  constructor(private readonly options: GameEventRecorderOptions, initialPhase: string) {
    this.replayPhaseCursor = initialPhase;
  }

  /** Record each new event once and return the delta for presentation. */
  flush(events: readonly GameEvent[]): GameEvent[] {
    const delta: GameEvent[] = [];
    const stageRegistry = getDefaultScriptEventRenderRegistry();
    for (let i = this.recordedEventIndex; i < events.length; i += 1) {
      const event = events[i];
      const stage = stageRegistry.toReplayStage(event);
      if (event.type === "phase_changed") {
        this.replayDayCursor = Number(event.payload.day ?? this.replayDayCursor);
        this.replayPhaseCursor = String(event.payload.phase ?? this.replayPhaseCursor);
      }
      this.options.replayManager.recordPublicEvent({
        type: event.type,
        timestampMs: event.timestamp,
        day: this.replayDayCursor,
        phase: this.replayPhaseCursor,
        stage,
        payload: { ...event.payload },
      });
      for (const playerId of this.options.world.entityIds()) {
        const nextVisibleSeq = (this.playerVisibleEventSeq.get(playerId) ?? 0) + 1;
        const visibleEvent = buildAgentVisibleEvent(this.options.world, event, playerId, nextVisibleSeq);
        if (!visibleEvent) continue;
        this.playerVisibleEventSeq.set(playerId, nextVisibleSeq);
        const roleComp = this.options.world.getComponent<RoleComponent>(playerId, COMPONENT.Role);
        this.options.replayManager.recordPlayerEvent({
          playerId,
          role: roleComp?.role ?? "unknown",
          camp: roleComp?.camp ?? "unknown",
          day: this.replayDayCursor,
          phase: this.replayPhaseCursor,
          stage,
          requestId: `${this.replayDayCursor}-${this.replayPhaseCursor}-${playerId}-event-${i + 1}`,
          timestampMs: event.timestamp,
          sourceEventSeq: i + 1,
          event: visibleEvent,
        });
      }
      this.recordedEventIndex = i + 1;
      delta.push(event);
    }
    return delta;
  }
}
