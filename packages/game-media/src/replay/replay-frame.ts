/**
 * 负责装配旧复盘渲染输入。输入为原归档与显示选项，输出兼容90帧采样的展示 DTO 和通用视频计划。
 * 纯事件视图由叶模块重导出；本层不拥有事实 reducer，不读取工作台焦点或运行时钟，也不写入归档。
 */
import {
  readReplayArchive,
  ReplayDocumentValidationError,
  type ReplayDocument,
  type RecordingEnvelope,
} from "@ai-werewolf-arena/replay-contract";
import { supportsGamePresentation } from "@ai-werewolf-arena/game-presentation";
import {
  validateReplayDisplay,
  DEFAULT_REPLAY_TIME_ZONE,
  type ReplayDisplayOptions,
} from "./replay-display";
import { buildPresentationReplay } from "./replay-presentation";
import {
  FRAMES_PER_EVENT,
  buildReplayFrame as buildEventFrame,
  type ReplayEventViewInput,
} from "./replay-event-view";
import type { ReplaySnapshot } from "./replay-projection";
import { compileVideoPlan } from "../video/compiler";
import { getVideoSourceIdentity } from "../video/source";
import type { VideoPlan } from "../video/types";

export { FRAMES_PER_EVENT } from "./replay-event-view";
export type ReplayRenderInput = ReplayEventViewInput & { plan?: VideoPlan };
/** 同一叶函数按旧输入类型重导出，保留带 plan 的内联 DTO 调用兼容性。 */
export const buildReplayFrame: (
  input: ReplayRenderInput,
  frame: number,
  capturedSnapshot?: ReplaySnapshot,
) => ReturnType<typeof buildEventFrame> = buildEventFrame;
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
    // 旧逐帧 API 保留90帧采样合同；工作台与新导出直接使用自动可读时长的通用计划。
    plan: compileVideoPlan(
      canonical,
      {
        source: getVideoSourceIdentity(canonical),
        edits: buildPresentationReplay(canonical).events.map((event) => ({
          anchor: { seq: event.seq, type: event.type },
          durationFrames: FRAMES_PER_EVENT,
        })),
      },
      options,
    ),
  };
}
