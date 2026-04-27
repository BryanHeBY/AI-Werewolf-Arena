/** 文件说明：领域事件到前端实时事件草稿的转换注册表。 */
import { Camp, GameEvent, Phase } from "../../../core/domain/model";
import {
  RealtimeGameEventDraft,
  makePublicEvent,
} from "./realtime_event_types";
import { toFrontendFaction, toFrontendPhase } from "../../../server/view_mapper";
import { GUARD_REALTIME_EVENT_HANDLERS } from "../roles/guard/event_presenters";
import { HUNTER_REALTIME_EVENT_HANDLERS } from "../roles/hunter/event_presenters";
import { SEER_REALTIME_EVENT_HANDLERS } from "../roles/seer/event_presenters";
import { WITCH_REALTIME_EVENT_HANDLERS } from "../roles/witch/event_presenters";
import { WOLF_REALTIME_EVENT_HANDLERS } from "../roles/wolf/event_presenters";
import { LAST_WORDS_REALTIME_EVENT_HANDLERS } from "../last_words/event_presenters";
import { SHERIFF_REALTIME_EVENT_HANDLERS } from "../sheriff/event_presenters";
import { IDIOT_REALTIME_EVENT_HANDLERS } from "../roles/idiot/event_presenters";
import {
  RealtimeEventHandler,
  RealtimeTranslateContext,
} from "./contracts";

function makeStateEvent(
  type: string,
  timestamp: number,
  ctx: RealtimeTranslateContext,
  data: Record<string, unknown> = {},
  actorId?: number | null,
  targetIds?: number[],
): RealtimeGameEventDraft {
  return makePublicEvent({
    category: "player_state",
    type,
    timestamp,
    data,
    actorId,
    targetIds,
    publicState: ctx.nowState,
  });
}

function makePlayerDiedEvent(
  playerId: number,
  timestamp: number,
  ctx: RealtimeTranslateContext,
  cause: string,
): RealtimeGameEventDraft {
  return makeStateEvent(
    "player.died",
    timestamp,
    ctx,
    {
      playerId,
      cause,
      roleType: ctx.getPlayerRole(playerId),
    },
    playerId,
    [playerId],
  );
}

const DEFAULT_HANDLERS: Record<string, RealtimeEventHandler> = {
  ...WOLF_REALTIME_EVENT_HANDLERS,
  ...SEER_REALTIME_EVENT_HANDLERS,
  ...GUARD_REALTIME_EVENT_HANDLERS,
  ...HUNTER_REALTIME_EVENT_HANDLERS,
  ...WITCH_REALTIME_EVENT_HANDLERS,
  ...IDIOT_REALTIME_EVENT_HANDLERS,
  ...LAST_WORDS_REALTIME_EVENT_HANDLERS,
  ...SHERIFF_REALTIME_EVENT_HANDLERS,
  phase_changed: (event, ctx) => {
    const phase = String(event.payload.phase ?? Phase.Night) as Phase;
    const day = Number(event.payload.day ?? ctx.nowState.round);
    return [
      makePublicEvent({
        category: "phase",
        type: "phase.changed",
        timestamp: event.timestamp,
        day,
        phase: toFrontendPhase(phase),
        stage: "started",
        data: {
          fromPhase: null,
          toPhase: toFrontendPhase(phase),
        },
        publicState: ctx.nowState,
      }),
    ];
  },
  day_speech: (event, ctx) => {
    const playerId = Number(event.payload.actorId);
    return [
      makePublicEvent({
        category: "system",
        type: "speech.start",
        timestamp: event.timestamp,
        actorId: playerId,
        targetIds: [playerId],
        stage: "started",
        data: {
          playerId,
          playerName: ctx.getPlayerName(playerId),
        },
      }),
      makePublicEvent({
        category: "player_action",
        type: "player.action.speak",
        timestamp: event.timestamp,
        actorId: playerId,
        data: {
          content: String(event.payload.text ?? ""),
        },
      }),
    ];
  },
  night_resolved: (event, ctx) => {
    const deadPlayerIds = Array.isArray(event.payload.deaths)
      ? event.payload.deaths.map((id) => Number(id))
      : [];
    const result: RealtimeGameEventDraft[] = [
      makePublicEvent({
        category: "night",
        type: "night.resolved",
        timestamp: event.timestamp,
        stage: "resolved",
        targetIds: deadPlayerIds,
        data: {
          deadPlayerIds,
          peacefulNight: deadPlayerIds.length === 0,
        },
        publicState: ctx.nowState,
      }),
    ];
    for (const playerId of deadPlayerIds) {
      result.push(makePlayerDiedEvent(playerId, event.timestamp, ctx, "night_kill"));
    }
    return result;
  },
  voted_out: (event, ctx) => {
    const target = Number(event.payload.target);
    return [
      makePublicEvent({
        category: "vote",
        type: "vote.resolved",
        timestamp: event.timestamp,
        stage: "resolved",
        targetIds: [target],
        data: {
          eliminatedPlayerId: target,
          eliminatedPlayerName: ctx.getPlayerName(target),
        },
        publicState: ctx.nowState,
      }),
      makePlayerDiedEvent(target, event.timestamp, ctx, "vote_out"),
    ];
  },
  vote_cast: (event) => [
    makePublicEvent({
      category: "player_action",
      type: "player.action.vote",
      timestamp: event.timestamp,
      actorId: Number(event.payload.actorId),
      targetIds:
        event.payload.targetId === null || event.payload.targetId === undefined
          ? []
          : [Number(event.payload.targetId)],
      data: {
        targetId:
          event.payload.targetId === null || event.payload.targetId === undefined
            ? null
            : Number(event.payload.targetId),
        abstain: Boolean(event.payload.abstain),
        weight: Number(event.payload.weight ?? 0),
      },
    }),
  ],
  sheriff_badge_transferred: (event, ctx) => [
    makeStateEvent(
      "player.badge_transferred",
      event.timestamp,
      ctx,
      {
        fromId: Number(event.payload.fromId),
        toId:
          event.payload.toId === null || event.payload.toId === undefined
            ? null
            : Number(event.payload.toId),
      },
      Number(event.payload.fromId),
      event.payload.toId === null || event.payload.toId === undefined
        ? [Number(event.payload.fromId)]
        : [Number(event.payload.fromId), Number(event.payload.toId)],
    ),
  ],
  sheriff_badge_destroyed: (event, ctx) => [
    makeStateEvent(
      "player.badge_destroyed",
      event.timestamp,
      ctx,
      {
        targetId: Number(event.payload.targetId),
      },
      Number(event.payload.targetId),
      [Number(event.payload.targetId)],
    ),
  ],
  game_over: (event, ctx) => {
    const winner = toFrontendFaction((event.payload.winner as Camp | null) ?? null);
    return [
      makePublicEvent({
        category: "result",
        type: "game.over",
        timestamp: event.timestamp,
        stage: "completed",
        data: {
          winner,
          reason: String(event.payload.reason ?? ""),
        },
        publicState: ctx.nowState,
      }),
      makePublicEvent({
        category: "result",
        type: "winner.declared",
        timestamp: event.timestamp,
        data: {
          winner,
          message: winner === "wolf" ? "🐺 狼人阵营获胜" : "👥 好人阵营获胜",
        },
      }),
    ];
  },
};

/** 实时事件转换注册表。 */
export class RealtimeEventRegistry {
  private readonly handlers: Record<string, RealtimeEventHandler>;

  constructor(handlers: Record<string, RealtimeEventHandler> = DEFAULT_HANDLERS) {
    this.handlers = { ...handlers };
  }

  translate(event: GameEvent, ctx: RealtimeTranslateContext): RealtimeGameEventDraft[] {
    const handler = this.handlers[event.type];
    if (!handler) {
      return [];
    }
    return handler(event, ctx);
  }
}

let defaultRegistry: RealtimeEventRegistry | null = null;

/** 获取默认实时事件转换注册表实例。 */
export function getDefaultRealtimeEventRegistry(): RealtimeEventRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RealtimeEventRegistry();
  }
  return defaultRegistry;
}
