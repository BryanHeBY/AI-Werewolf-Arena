/**
 * 负责从已读复盘和显示选项构建当前帧的纯画面数据。输入为复盘、帧进度与时间／语言设置；输出为原阶段、玩家和结果展示信息。保留原校验和投影顺序，不依赖工作台交互状态，也不写入归档。
 */
import {
  readReplayArchive,
  ReplayDocumentValidationError,
  type ReplayDocument,
  type RecordingEnvelope,
} from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { victoryPointLabel, supportsGamePresentation } from "@ai-werewolf-arena/game-presentation";
import {
  formatReplayTime,
  validateReplayDisplay,
  DEFAULT_REPLAY_TIME_ZONE,
  type ReplayDisplayOptions,
} from "./replay-display";
import { buildPresentationReplay, type PresentationReplay } from "./replay-presentation";
import { buildReplaySnapshot } from "./replay-projection";
import { eventLabel } from "./event-labels";
import { phaseName, roleName, eventStageName } from "./replay-localization";

export const FRAMES_PER_EVENT = 90;
export type ReplayRenderInput = ReplayDisplayOptions & { replay: PresentationReplay };
/** 离线画面输入不依赖工作台焦点、播放状态、运行时钟或宿主时区；直接新封装也必须核对展示声明。 */
export function createReplayRenderInput(
  replay: ReplayDocument | RecordingEnvelope<ReplayDocument>,
  display?: ReplayDisplayOptions,
): ReplayRenderInput {
  const archive = readReplayArchive(replay);
  if (archive.identities && !supportsGamePresentation(archive.identities.presentation))
    throw new ReplayDocumentValidationError("unsupported_version", "identities.presentation");
  const canonical = archive.replay;
  const options = display ?? {
    locale: canonical.meta.locale ?? "zh-CN",
    timeZone: DEFAULT_REPLAY_TIME_ZONE,
  };
  validateReplayDisplay(options);
  return {
    replay: buildPresentationReplay(canonical),
    locale: options.locale,
    timeZone: options.timeZone,
  };
}
export function buildReplayFrame(input: ReplayRenderInput, frame: number) {
  validateReplayDisplay(input);
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error("replay_frame_invalid");
  const { replay, locale } = input;
  const eventIndex = Math.min(Math.floor(frame / FRAMES_PER_EVENT), replay.events.length - 1);
  const snapshot = buildReplaySnapshot(replay, eventIndex);
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
