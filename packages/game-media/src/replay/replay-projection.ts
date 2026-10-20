/**
 * 负责按事件游标把复盘事实投影为席位与当前阶段。输入为原归档和事件索引，输出画面状态副本。
 * 投影消费共享事实 reader，不执行后端规则、不推进真实对局或把画面状态当行动许可。
 */
import {
  type ReplayDocument,
  type ReplayEvent,
  type ReplayFact,
} from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent, readReplayEventEnvelope } from "./replay-event-reader";
import type { SealedVictoryResult } from "@ai-werewolf-arena/game-contract";
import { createReplayRosterActivity, type ReplayRosterActivity } from "./replay-roster-activity";

export interface ReplayPlayerState {
  playerId: number;
  name?: string;
  role: string;
  camp: string;
  alive: boolean;
  isSheriff: boolean;
  isWinner: boolean;
  publicRole?: string;
  /** 已记录活动窗口的展示范围；不表示角色能力或行动许可。 */
  rosterActivity?: ReplayRosterActivity;
}

export interface ReplaySnapshot {
  event: ReplayEvent | null;
  players: ReplayPlayerState[];
  day: number;
  phase: string;
  decision: SealedVictoryResult | null;
}

/** 单一 effect reducer 拥有本次投影状态；索引和单帧入口共用它，不创建另一份游戏结算规则。 */
type ProjectionReplay = Pick<ReplayDocument, "players" | "events"> &
  Partial<Pick<ReplayDocument, "facts" | "factCoverage">>;
function createProjector(replay: ProjectionReplay) {
  const rosterActivity = createReplayRosterActivity();
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
      rosterActivity.append(fact.event);
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
          // 新录制明确覆盖真实死亡提交，提案、刀票、夜报都不能提前改变生命；旧档保留兼容投影。
          if (replay.factCoverage?.committedDeaths !== 1)
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
    appendFact: (fact: ReplayFact) => {
      day = fact.day;
      rosterActivity.atDay(day);
      if (fact.kind === "life_committed") markDead(fact.playerId);
    },
    snapshot: (): ReplaySnapshot => ({
      event: event ? structuredClone(event) : null,
      players: [...states.values()]
        .map((player) => {
          const activity = rosterActivity.forPlayer(player.playerId);
          return { ...player, ...(activity ? { rosterActivity: activity } : {}) };
        })
        .sort((left, right) => left.playerId - right.playerId),
      day,
      phase,
      decision: decision ? structuredClone(decision) : null,
    }),
  };
}

/** 原独立投影入口保持游标夹入规则；只扫描所需前缀，返回脱离运行状态的副本。 */
export function buildReplaySnapshot(replay: ProjectionReplay, eventIndex: number): ReplaySnapshot {
  const projector = createProjector(replay);
  const lastIndex = Math.min(Math.max(eventIndex, 0), replay.events.length - 1);
  let factIndex = 0;
  const appendFacts = (seq: number) => {
    while (replay.facts?.[factIndex] && replay.facts[factIndex]!.afterSeq <= seq)
      projector.appendFact(replay.facts[factIndex++]!);
  };
  appendFacts(0);
  for (let index = 0; index <= lastIndex; index++) {
    projector.append(replay.events[index]!);
    appendFacts(replay.events[index]!.seq);
  }
  return projector.snapshot();
}

/** 一次按完整事件序列建立各前缀快照；视频跳剪仍取原游标，逐帧和重复镜头不再扫描历史。 */
export function createReplaySnapshotIndex(replay: ProjectionReplay): ReplaySnapshot[] {
  return createReplayCursorIndex(replay).settledEvents;
}

/** 原事件之前的初始快照也由同一 reducer 创建，供揭晓动画保留事前状态。 */
export function createReplayInitialSnapshot(replay: ProjectionReplay): ReplaySnapshot {
  return createProjector(replay).snapshot();
}

/**
 * 一次顺序建立原事件前缀与独立提交事实的索引。events 是该事件之后、同 afterSeq 事实之前；
 * facts 是逐项真实提交之后；settledEvents 兼容旧前缀入口，包含该游标全部事实。索引不猜结算结果。
 */
export function createReplayCursorIndex(replay: ProjectionReplay) {
  const projector = createProjector(replay);
  const initial = projector.snapshot();
  const events: ReplaySnapshot[] = [],
    facts: ReplaySnapshot[] = [],
    settledEvents: ReplaySnapshot[] = [];
  let factIndex = 0;
  const appendFacts = (seq: number) => {
    while (replay.facts?.[factIndex] && replay.facts[factIndex]!.afterSeq <= seq) {
      projector.appendFact(replay.facts[factIndex++]!);
      facts.push(projector.snapshot());
    }
  };
  appendFacts(0);
  const initialSettled = factIndex ? projector.snapshot() : initial;
  for (const event of replay.events) {
    projector.append(event);
    const eventSnapshot = projector.snapshot();
    events.push(eventSnapshot);
    const beforeFacts = factIndex;
    appendFacts(event.seq);
    // 没有新增事实时两个游标就是同一不可变前缀，不重复克隆整份席位状态。
    settledEvents.push(beforeFacts === factIndex ? eventSnapshot : projector.snapshot());
  }
  return { initial, initialSettled, events, facts, settledEvents };
}
