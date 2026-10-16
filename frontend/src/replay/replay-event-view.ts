/**
 * 负责把复盘事件游标映射为纯画面数据。输入为展示复盘、语言时区、原事件索引或旧帧号，输出阶段、席位、字幕与终局展示。
 * 本叶模块只消费唯一事实投影，不装配视频计划、不依赖工作台或 Remotion；传入已缓存快照时不重扫事件前缀。
 * 旧 buildReplayFrame 保留90帧采样和越界钳制语义，视频编译器直接使用事件索引避免混淆三种时钟。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { victoryPointLabel } from "@ai-werewolf-arena/game-presentation";
import {
  formatReplayTime,
  validateReplayDisplay,
  type ReplayDisplayOptions,
} from "./replay-display";
import type { PresentationReplay } from "./replay-presentation";
import { buildReplaySnapshot, type ReplaySnapshot } from "./replay-projection";
import { eventLabel } from "./event-labels";
import { phaseName, roleName, eventStageName } from "./replay-localization";

export const FRAMES_PER_EVENT = 90;
export type ReplayEventViewInput = ReplayDisplayOptions & { replay: PresentationReplay };

/** 新编排入口以事件数组游标采样；-1 仅用于无事件归档。 */
export function buildReplayEventView(
  input: ReplayEventViewInput,
  index: number,
  capturedSnapshot?: ReplaySnapshot,
) {
  validateReplayDisplay(input);
  if (!Number.isSafeInteger(index) || (index < 0 && !(index === -1 && !input.replay.events.length)))
    throw new Error("replay_event_index_invalid");
  return eventView(input, Math.min(index, input.replay.events.length - 1), capturedSnapshot);
}

/** 兼容旧90帧采样 API，错误顺序和终帧钳制与原入口一致。 */
export function buildReplayFrame(
  input: ReplayEventViewInput,
  frame: number,
  capturedSnapshot?: ReplaySnapshot,
) {
  validateReplayDisplay(input);
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error("replay_frame_invalid");
  return eventView(
    input,
    Math.min(Math.floor(frame / FRAMES_PER_EVENT), input.replay.events.length - 1),
    capturedSnapshot,
  );
}

function eventView(
  input: ReplayEventViewInput,
  eventIndex: number,
  capturedSnapshot?: ReplaySnapshot,
) {
  const { replay, locale } = input;
  const snapshot = capturedSnapshot ?? buildReplaySnapshot(replay, eventIndex);
  const event = snapshot.event;
  return {
    eventIndex,
    eventSeq: event?.seq ?? null,
    snapshot,
    dayPhase: text(locale, "replay.day_phase", {
      day: snapshot.day,
      phase: phaseName(snapshot.phase, locale),
    }),
    stage: event
      ? eventStageName(
          event,
          locale,
          replay.players.map((player) => player.player_id),
        )
      : text(locale, "replay.start"),
    label: event
      ? eventLabel(
          event,
          locale,
          replay.players.map((player) => player.player_id),
          replay.players.map((player) => ({ id: player.player_id, name: player.name })),
        )
      : text(locale, "replay.no_events"),
    time: formatReplayTime(event?.timestamp, input),
    victory: snapshot.decision ? victoryPointLabel(snapshot.decision.decidedAt, locale) : null,
    winnerLabel: text(locale, "victory.winner_badge"),
    players: snapshot.players.map((player) => ({
      ...player,
      roleLabel: roleName(
        player.role === "unknown" && player.publicRole ? player.publicRole : player.role,
        locale,
      ),
      sheriffLabel: player.isSheriff ? text(locale, "replay.sheriff") : "",
    })),
  };
}
