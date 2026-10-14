/**
 * 负责把新增领域事件与当时获授权的玩家视图交给会话记录器，返回完成处理的展示增量。
 * 输入为本局原 World 和事件序列；输出为 God／玩家记录，最终落盘归会话记录器。
 * 本模块拥有事件游标、记录日期／阶段和玩家局部序号，不推进游戏阶段或选择行动。
 * 记录失败向调用方传播并保留已追加前缀；领域提交与受众授权仍由各自所有者负责。
 * 游标不是跨失败重放的事务保证，不能把一次中途异常当成整条事件从未记录。
 */
import type { World } from "../core/domain/world";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import { COMPONENT, RoleComponent } from "../core";
import { buildAgentVisibleEvent } from "../game/engine/agent_visible_event_feed";
import { getDefaultScriptEventRenderRegistry } from "../game";
import type { SessionRecordManager } from "../recording/session_recorder";

/** 持有同一局的领域读取入口与记录入口，不创建第二份状态或自行管理记录器关闭。 */
export interface GameEventRecorderOptions {
  world: World;
  replayManager: SessionRecordManager;
}

export class GameEventRecorder {
  private recordedEventIndex = 0;
  // 每位玩家只为可见事件递增序号，不能用 God 事件索引泄漏隐藏行动数量。
  private readonly playerVisibleEventSeq = new Map<number, number>();
  // 这是复盘记录的标签游标；只随 phase_changed 更新，不写回领域阶段。
  private replayDayCursor = 1;
  private replayPhaseCursor: string;

  constructor(
    private readonly options: GameEventRecorderOptions,
    initialPhase: string,
  ) {
    this.replayPhaseCursor = initialPhase;
  }

  /** 从事件游标处理新增事实；只有当前事件全部处理完成后才推进该游标。 */
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
      // God 记录先追加，随后逐玩家投影；后续失败不撤销先前已追加的记录。
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
        const visibleEvent = buildAgentVisibleEvent(
          this.options.world,
          event,
          playerId,
          nextVisibleSeq,
        );
        if (!visibleEvent) continue;
        // 按原顺序先占用局部序号再追加玩家记录；写入抛错时序号与前缀不会回滚。
        this.playerVisibleEventSeq.set(playerId, nextVisibleSeq);
        const roleComp = this.options.world.getComponent(playerId, COMPONENT.Role);
        this.options.replayManager.recordPlayerEvent({
          playerId,
          role: roleComp?.role ?? "unknown",
          camp: (roleComp && this.options.world.getComponent(playerId, COMPONENT.Camp)?.camp) ?? "unknown",
          day: this.replayDayCursor,
          phase: this.replayPhaseCursor,
          stage: visibleEvent.type === "player_shot" ? "death_shot" : stage,
          requestId: `${this.replayDayCursor}-${this.replayPhaseCursor}-${playerId}-event-${nextVisibleSeq}`,
          timestampMs: event.timestamp,
          // 玩家来源序号属于自己的视图；全局索引会暴露隐藏 God 事件的数量。
          sourceEventSeq: nextVisibleSeq,
          event: visibleEvent,
        });
      }
      // 全部玩家视图处理完才推进主游标；中途失败不伪造原子提交或自动去重。
      this.recordedEventIndex = i + 1;
      delta.push(event);
    }
    return delta;
  }
}
