/**
 * 负责将统一镜头时钟绑定到原事件／事实前缀。输入为来源游标、只读视图及调度结果，输出按帧状态切换点。
 * 切换点字段由本模块装配，历史状态仍归唯一投影拥有；不重新安排揭晓、不计算伤害，hold 和旧布局保留即时状态。
 */
import type { VideoLayoutId, VideoScene, VideoShot } from "../types";
import type { VideoShotSource, VideoSourceIndex } from "./source-index";
import type { VideoShotTiming } from "./shot-timing";

export function compileVideoShotState(
  source: VideoSourceIndex,
  selected: VideoShotSource,
  timing: VideoShotTiming,
  options: { layout: VideoLayoutId; kind: VideoShot["kind"]; baseKind: VideoScene["kind"] },
): VideoShot["stateCues"] {
  const { index, endIndex, committedFact, view, primaryView } = selected;
  const { layout, kind, baseKind } = options;
  const after = {
    frame: 0,
    throughSeq: selected.after.throughSeq,
    throughFactSeq: selected.after.throughFactSeq,
    view,
  };
  const delayed =
    layout === "broadcast-v1" &&
    kind !== "hold" &&
    (index >= 0 || committedFact) &&
    baseKind !== "speech" &&
    (timing.reveal.impact > 0 || (endIndex > index && timing.reveal.result > timing.reveal.impact));
  if (!delayed) return [after];
  const before = {
    frame: 0,
    throughSeq: Math.max(0, selected.before.throughSeq),
    throughFactSeq: selected.before.throughFactSeq,
    view: source.viewAt(selected.before),
  };
  return [
    ...(timing.reveal.impact > 0 ? [before] : []),
    ...(endIndex > index
      ? [
          {
            frame: timing.reveal.impact,
            throughSeq: selected.primary.throughSeq,
            throughFactSeq: selected.primary.throughFactSeq,
            view: primaryView,
          },
          { ...after, frame: timing.reveal.result },
        ]
      : [{ ...after, frame: timing.reveal.impact }]),
  ];
}
