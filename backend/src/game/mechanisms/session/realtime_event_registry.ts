/** 文件说明：领域事件到前端实时事件的转换注册表。 */
import { Camp, GameEvent, Phase } from "../../../core/domain/model";
import { RealtimeGameEvent } from "./realtime_event_types";
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

function makePublicEvent(
  type: string,
  data: Record<string, unknown>,
  timestamp: number,
): RealtimeGameEvent {
  return {
    type,
    timestamp,
    data,
    visibility: { scope: "public" },
  };
}

function makePlayerDiedEvent(
  playerId: number,
  timestamp: number,
  ctx: RealtimeTranslateContext,
): RealtimeGameEvent {
  return makePublicEvent(
    "player_died",
    {
      playerId,
      roleType: ctx.getPlayerRole(playerId),
    },
    timestamp,
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
      makePublicEvent(
        "phase_changed",
        {
          phase: toFrontendPhase(phase),
          round: day,
          gameState: ctx.nowState,
        },
        event.timestamp,
      ),
    ];
  },
  day_speech: (event, ctx) => {
    const playerId = Number(event.payload.actorId);
    return [
      makePublicEvent(
        "speech_start",
        {
          playerId,
          playerName: ctx.getPlayerName(playerId),
        },
        event.timestamp,
      ),
      makePublicEvent(
        "player_action",
        {
          playerId,
          actionType: "speak",
          content: String(event.payload.text ?? ""),
        },
        event.timestamp,
      ),
    ];
  },
  night_resolved: (event, ctx) => {
    const deadPlayerIds = Array.isArray(event.payload.deaths)
      ? event.payload.deaths.map((id) => Number(id))
      : [];
    const result: RealtimeGameEvent[] = [
      makePublicEvent(
        "night_result",
        {
          deadPlayerIds,
        },
        event.timestamp,
      ),
    ];
    for (const playerId of deadPlayerIds) {
      result.push(makePlayerDiedEvent(playerId, event.timestamp, ctx));
    }
    return result;
  },
  voted_out: (event, ctx) => {
    const target = Number(event.payload.target);
    return [
      makePublicEvent(
        "vote_result",
        {
          votedOutId: target,
          votedOutName: ctx.getPlayerName(target),
        },
        event.timestamp,
      ),
      makePlayerDiedEvent(target, event.timestamp, ctx),
    ];
  },
  vote_cast: (event) => [
    makePublicEvent(
      "vote_cast",
      {
        actorId: Number(event.payload.actorId),
        targetId:
          event.payload.targetId === null || event.payload.targetId === undefined
            ? null
            : Number(event.payload.targetId),
        abstain: Boolean(event.payload.abstain),
        weight: Number(event.payload.weight ?? 0),
      },
      event.timestamp,
    ),
  ],
  sheriff_badge_transferred: (event) => [
    makePublicEvent(
      "sheriff_badge_transferred",
      {
        fromId: Number(event.payload.fromId),
        toId:
          event.payload.toId === null || event.payload.toId === undefined
            ? null
            : Number(event.payload.toId),
      },
      event.timestamp,
    ),
  ],
  sheriff_badge_destroyed: (event) => [
    makePublicEvent(
      "sheriff_badge_destroyed",
      {
        targetId: Number(event.payload.targetId),
      },
      event.timestamp,
    ),
  ],
  game_over: (event, ctx) => {
    const winner = toFrontendFaction((event.payload.winner as Camp | null) ?? null);
    return [
      makePublicEvent(
        "game_over",
        {
          winner,
          gameState: ctx.nowState,
        },
        event.timestamp,
      ),
      makePublicEvent(
        "winner_declared",
        {
          winner,
          message: winner === "wolf" ? "🐺 狼人阵营获胜" : "👥 好人阵营获胜",
        },
        event.timestamp,
      ),
    ];
  },
};

/** 实时事件转换注册表。 */
export class RealtimeEventRegistry {
  private readonly handlers: Record<string, RealtimeEventHandler>;

  constructor(handlers: Record<string, RealtimeEventHandler> = DEFAULT_HANDLERS) {
    this.handlers = { ...handlers };
  }

  translate(event: GameEvent, ctx: RealtimeTranslateContext): RealtimeGameEvent[] {
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
