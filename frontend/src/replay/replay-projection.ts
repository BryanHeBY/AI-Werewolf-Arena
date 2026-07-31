import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";

export interface ReplayPlayerState {
  playerId: number;
  role: string;
  camp: string;
  alive: boolean;
  isSheriff: boolean;
}

export interface ReplaySnapshot {
  event: ReplayEvent | null;
  players: ReplayPlayerState[];
  day: number;
  phase: string;
}

const ROLE_NAMES: Record<string, string> = {
  wolf: "狼人",
  seer: "预言家",
  witch: "女巫",
  hunter: "猎人",
  idiot: "白痴",
  guard: "守卫",
  villager: "平民",
};

const CAMP_NAMES: Record<string, string> = {
  wolf: "狼人阵营",
  good: "好人阵营",
};

const PHASE_NAMES: Record<string, string> = {
  night: "夜晚",
  day: "白天",
  voting: "放逐投票",
  game_over: "对局结束",
};

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const number = numberValue(item);
    return number === null ? [] : [number];
  }) : [];
}

export function roleName(role: string): string {
  return ROLE_NAMES[role] ?? role;
}

export function campName(camp: string): string {
  return CAMP_NAMES[camp] ?? camp;
}

export function phaseName(phase: string): string {
  return PHASE_NAMES[phase] ?? phase;
}

export function buildReplaySnapshot(replay: ReplayDocument, eventIndex: number): ReplaySnapshot {
  const states = new Map(replay.players.map((player) => [player.player_id, {
    playerId: player.player_id,
    role: player.role,
    camp: player.camp,
    alive: true,
    isSheriff: false,
  }]));
  const lastIndex = Math.min(Math.max(eventIndex, 0), replay.events.length - 1);

  for (const event of replay.events.slice(0, lastIndex + 1)) {
    const payload = event.payload;
    if (event.type === "night_resolved") {
      for (const playerId of numberArray(payload.deaths)) {
        const player = states.get(playerId);
        if (player) player.alive = false;
      }
    }
    if (event.type === "voted_out") {
      const playerId = numberValue(payload.target);
      if (playerId !== null && states.has(playerId)) states.get(playerId)!.alive = false;
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
      const playerId = numberValue(payload.fromId);
      if (playerId !== null && states.has(playerId)) states.get(playerId)!.isSheriff = false;
    }
  }

  const event = replay.events[lastIndex] ?? null;
  return {
    event,
    players: [...states.values()].sort((left, right) => left.playerId - right.playerId),
    day: event?.day ?? 0,
    phase: event?.phase ?? "night",
  };
}
