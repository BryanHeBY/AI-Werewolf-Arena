import { readVictoryResult, type ReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import type { SealedVictoryResult } from "@ai-werewolf-arena/game-catalog";

export interface ReplayPlayerState {
  playerId: number;
  name?: string;
  role: string;
  camp: string;
  alive: boolean;
  isSheriff: boolean;
  isWinner: boolean;
}

export interface ReplaySnapshot {
  event: ReplayEvent | null;
  players: ReplayPlayerState[];
  day: number;
  phase: string;
  decision: SealedVictoryResult | null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const number = numberValue(item);
    return number === null ? [] : [number];
  }) : [];
}

export function buildReplaySnapshot(replay: ReplayDocument, eventIndex: number): ReplaySnapshot {
  const states = new Map(replay.players.map((player) => [player.player_id, {
    playerId: player.player_id,
    ...(player.name === undefined ? {} : { name: player.name }),
    role: player.role,
    camp: player.camp,
    alive: true,
    isSheriff: false,
    isWinner: false,
  }]));
  const lastIndex = Math.min(Math.max(eventIndex, 0), replay.events.length - 1);
  let decision: SealedVictoryResult | null = null;

  const markDead = (playerId: number | null) => {
    if (playerId !== null && states.has(playerId)) states.get(playerId)!.alive = false;
  };

  for (const event of replay.events.slice(0, lastIndex + 1)) {
    const payload = event.payload;
    if (event.type === "game_over" && Object.hasOwn(payload, "outcome")) {
      try {
        decision = readVictoryResult(payload, [...states.keys()]);
        const winners = decision.outcome.kind === "victory" ? decision.outcome.winningPlayerIds : [];
        for (const player of states.values()) player.isWinner = winners.includes(player.playerId);
      } catch { /* Malformed explicit facts do not imply winner membership. */ }
    }
    if (event.type === "night_resolved"||event.type==="additional_deaths") {
      for (const playerId of numberArray(payload.deaths)) {
        markDead(playerId);
      }
    }
    if (event.type === "voted_out") {
      markDead(numberValue(payload.target));
    }
    if(event.type==="dream_death"&&(payload.reason==="consecutive"||payload.reason==="linked"))markDead(numberValue(payload.targetId));
    if(event.type==="charm_death")markDead(numberValue(payload.targetId));
    if (event.type === "wolf_self_destruct") {
      markDead(numberValue(payload.wolfId));
    }
    if (event.type === "white_wolf_king_self_destruct") {
      markDead(numberValue(payload.actorId)); markDead(numberValue(payload.targetId));
    }
    if (event.type === "knight_duel") {
      if (payload.result === "wolf") markDead(numberValue(payload.targetId));
      if (payload.result === "not_wolf") markDead(numberValue(payload.actorId));
    }
    if (event.type === "hunter_shot" || event.type === "wolf_king_shot") {
      markDead(numberValue(payload.targetId));
    }
    if (event.type === "sheriff_elected") {
      const playerId = numberValue(payload.winnerId);
      for (const player of states.values()) player.isSheriff = player.playerId === playerId;
    }
    if (event.type === "sheriff_badge_transferred") {
      const fromId = numberValue(payload.fromId);
      const toId = numberValue(payload.toId);
      if (fromId !== null && states.has(fromId)) states.get(fromId)!.isSheriff = false;
      if (toId !== null && states.has(toId)) states.get(toId)!.isSheriff = true;
    }
    if (event.type === "sheriff_badge_destroyed") {
      const playerId = numberValue(payload.targetId);
      if (playerId !== null && states.has(playerId)) states.get(playerId)!.isSheriff = false;
    }
  }

  const event = replay.events[lastIndex] ?? null;
  return {
    event,
    players: [...states.values()].sort((left, right) => left.playerId - right.playerId),
    day: event?.day ?? 0,
    phase: event?.phase ?? "night",
    decision,
  };
}
