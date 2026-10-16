/**
 * 负责按事件游标把复盘事实投影为席位与当前阶段。输入为原归档和事件索引，输出画面状态副本。
 * 投影消费共享事实 reader，不执行后端规则、不推进真实对局或把画面状态当行动许可。
 */
import { type ReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent, readReplayEventEnvelope } from "./replay-event-reader";
import type { SealedVictoryResult } from "@ai-werewolf-arena/game-contract";

export interface ReplayPlayerState {
  playerId: number;
  name?: string;
  role: string;
  camp: string;
  alive: boolean;
  isSheriff: boolean;
  isWinner: boolean;
  publicRole?: string;
}

export interface ReplaySnapshot {
  event: ReplayEvent | null;
  players: ReplayPlayerState[];
  day: number;
  phase: string;
  decision: SealedVictoryResult | null;
}

/** 单一 effect reducer 拥有本次投影状态；索引和单帧入口共用它，不创建另一份游戏结算规则。 */
function createProjector(replay: Pick<ReplayDocument, "players" | "events">) {
  const states = new Map<number, ReplayPlayerState>(
    replay.players.map((player) => [
      player.player_id,
      {
        playerId: player.player_id,
        ...(player.name === undefined ? {} : { name: player.name }),
        role: player.role,
        camp: player.camp,
        alive: true,
        isSheriff: false,
        isWinner: false,
      },
    ]),
  );
  let decision: SealedVictoryResult | null = null;

  const markDead = (playerId: number | null) => {
    if (playerId !== null && states.has(playerId)) states.get(playerId)!.alive = false;
  };

  const playerIds = [...states.keys()];
  let event: ReplayEvent | null = null,
    day = 0,
    phase = "night";
  const append = (raw: ReplayEvent) => {
    const fact = readReplayEvent(raw, playerIds);
    event = fact?.event ?? readReplayEventEnvelope(raw);
    if (fact) {
      day = fact.event.day;
      phase = fact.event.phase;
    }
    for (const effect of fact?.effects ?? []) {
      switch (effect.kind) {
        case "camp_changed":
          states.get(effect.playerId)!.camp = effect.camp;
          break;
        case "identity_changed":
          states.get(effect.playerId)!.role = effect.role;
          states.get(effect.playerId)!.camp = effect.camp;
          break;
        case "role_revealed":
          (states.get(effect.playerId)! as ReplayPlayerState).publicRole = effect.role;
          break;
        case "deaths":
          for (const playerId of effect.playerIds) markDead(playerId);
          break;
        case "sheriff_elected":
          for (const player of states.values())
            player.isSheriff = player.playerId === effect.playerId;
          break;
        case "sheriff_transferred":
          states.get(effect.fromId)!.isSheriff = false;
          states.get(effect.toId)!.isSheriff = true;
          break;
        case "sheriff_destroyed":
          states.get(effect.playerId)!.isSheriff = false;
          break;
        case "victory": {
          decision = effect.decision;
          const winners =
            decision.outcome.kind === "victory" ? decision.outcome.winningPlayerIds : [];
          for (const player of states.values()) player.isWinner = winners.includes(player.playerId);
          break;
        }
      }
    }
  };
  return {
    append,
    snapshot: (): ReplaySnapshot => ({
      event: event ? structuredClone(event) : null,
      players: [...states.values()]
        .map((player) => ({ ...player }))
        .sort((left, right) => left.playerId - right.playerId),
      day,
      phase,
      decision: decision ? structuredClone(decision) : null,
    }),
  };
}

/** 原独立投影入口保持游标夹入规则；只扫描所需前缀，返回脱离运行状态的副本。 */
export function buildReplaySnapshot(
  replay: Pick<ReplayDocument, "players" | "events">,
  eventIndex: number,
): ReplaySnapshot {
  const projector = createProjector(replay);
  const lastIndex = Math.min(Math.max(eventIndex, 0), replay.events.length - 1);
  for (let index = 0; index <= lastIndex; index++) projector.append(replay.events[index]!);
  return projector.snapshot();
}

/** 一次按完整事件序列建立各前缀快照；视频跳剪仍取原游标，逐帧和重复镜头不再扫描历史。 */
export function createReplaySnapshotIndex(
  replay: Pick<ReplayDocument, "players" | "events">,
): ReplaySnapshot[] {
  const projector = createProjector(replay);
  return replay.events.map((event) => {
    projector.append(event);
    return projector.snapshot();
  });
}
