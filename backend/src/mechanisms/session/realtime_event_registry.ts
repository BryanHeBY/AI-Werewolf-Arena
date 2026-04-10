import { Camp, GameEvent, Phase } from "../../domain/model";
import { RealtimeGameEvent } from "../../infra/transport/broadcaster";
import { FrontendGameState, toFrontendFaction, toFrontendPhase } from "../../server/view_mapper";

export interface RealtimeTranslateContext {
  nowState: FrontendGameState;
  getPlayerName: (playerId: number) => string;
  getPlayerRole: (playerId: number) => string;
}

type RealtimeEventHandler = (
  event: GameEvent,
  ctx: RealtimeTranslateContext,
) => RealtimeGameEvent[];

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

function makeWolvesOnlyEvent(
  type: string,
  data: Record<string, unknown>,
  timestamp: number,
): RealtimeGameEvent {
  return {
    type,
    timestamp,
    data,
    visibility: { scope: "wolves_only" },
  };
}

function makePrivateTargetsEvent(
  type: string,
  data: Record<string, unknown>,
  targetPlayerIds: number[],
  timestamp: number,
): RealtimeGameEvent {
  return {
    type,
    timestamp,
    data,
    visibility: {
      scope: "private_targets",
      targetPlayerIds,
    },
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
  wolf_tactical_order: (event) => [
    makeWolvesOnlyEvent(
      "wolf_tactical_order",
      {
        order: Array.isArray(event.payload.order) ? event.payload.order : [],
      },
      event.timestamp,
    ),
  ],
  wolf_discussion: (event) => [
    makeWolvesOnlyEvent(
      "wolf_discussion",
      {
        actorId: Number(event.payload.actorId),
        text: String(event.payload.text ?? ""),
      },
      event.timestamp,
    ),
  ],
  guard_applied: (event) => {
    const actorId = Number(event.payload.actorId);
    const abstain = Boolean(event.payload.abstain);
    return [
      makePrivateTargetsEvent(
        "guard_applied",
        {
          actorId,
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          abstain,
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
  wolf_kill_vote_cast: (event) => {
    const abstain = Boolean(event.payload.abstain);
    return [
      makeWolvesOnlyEvent(
        "wolf_kill_vote_cast",
        {
          actorId: Number(event.payload.actorId),
          targetId:
            event.payload.targetId === null || event.payload.targetId === undefined
              ? null
              : Number(event.payload.targetId),
          abstain,
        },
        event.timestamp,
      ),
    ];
  },
  seer_checked: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      makePrivateTargetsEvent(
        "seer_checked",
        {
          actorId,
          targetId: Number(event.payload.targetId),
          isWerewolf: Boolean(event.payload.isWerewolf),
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
  witch_potion_used: (event) => {
    const actorId = Number(event.payload.actorId);
    return [
      makePrivateTargetsEvent(
        "witch_potion_used",
        {
          actorId,
          targetId: Number(event.payload.targetId),
          potionType: String(event.payload.potionType ?? ""),
        },
        [actorId],
        event.timestamp,
      ),
    ];
  },
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
          killedByWolf:
            event.payload.wolfTarget !== undefined
              ? Number(event.payload.wolfTarget)
              : undefined,
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
  wolf_self_destruct: (event, ctx) => {
    const wolfId = Number(event.payload.wolfId);
    return [makePlayerDiedEvent(wolfId, event.timestamp, ctx)];
  },
  hunter_shot: (event, ctx) => {
    const hunterId = Number(event.payload.hunterId);
    const targetId = Number(event.payload.targetId);
    return [
      makePublicEvent(
        "player_action",
        {
          playerId: hunterId,
          actionType: "kill",
          targetId,
        },
        event.timestamp,
      ),
      makePlayerDiedEvent(targetId, event.timestamp, ctx),
    ];
  },
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

export function getDefaultRealtimeEventRegistry(): RealtimeEventRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new RealtimeEventRegistry();
  }
  return defaultRegistry;
}
