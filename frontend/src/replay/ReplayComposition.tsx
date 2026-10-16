/**
 * 负责将旧复盘逐帧入口接入通用视频画面。输入为已有展示 DTO 或显式视频计划，输出同一镜头、字幕与席位组件。
 * 旧 DTO 的90帧采样继续兼容；原归档锚点与变长时序由 canonical 视频计划持有，本适配器不重算规则。
 */
import { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { compileVideoPlan, getVideoSourceIdentity, VideoFrame } from "../video";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { FRAMES_PER_EVENT, type ReplayRenderInput } from "./replay-frame";
export { FRAMES_PER_EVENT } from "./replay-frame";

/** 仅兼容手工构造的旧展示输入；重编号只供内部采样，源 seq 在画面 DTO 中保留。 */
function legacyPlan(input: ReplayRenderInput) {
  if (input.plan) return input.plan;
  const { kind: _kind, sourceSchemaVersion, sourcePerspective, ...content } = input.replay;
  const canonical: ReplayDocument = {
    ...content,
    schemaVersion: sourceSchemaVersion,
    perspective: sourcePerspective,
    events: content.events.map((event, index) => ({ ...event, seq: index + 1 })),
  };
  const plan = compileVideoPlan(
    canonical,
    {
      source: getVideoSourceIdentity(canonical),
      edits: canonical.events.map((event) => ({
        anchor: { seq: event.seq, type: event.type },
        durationFrames: FRAMES_PER_EVENT,
      })),
    },
    input,
  );
  for (const shot of plan.shots) {
    const original = input.replay.events[shot.eventIndex];
    if (!original) continue;
    shot.eventSeq = original.seq;
    shot.view.eventSeq = original.seq;
    if (shot.view.snapshot.event) shot.view.snapshot.event.seq = original.seq;
  }
  return plan;
}

export function ReplayComposition(input: ReplayRenderInput) {
  const frame = useCurrentFrame();
  const plan = useMemo(
    () => legacyPlan(input),
    [input.plan, input.replay, input.locale, input.timeZone],
  );
  return <VideoFrame plan={plan} frame={frame} />;
}

/** 测试与旧调用方可直接采样帧；画面仍由通用渲染组件持有。 */
export function ReplayFrame({ input, frame }: { input: ReplayRenderInput; frame: number }) {
  return <VideoFrame plan={legacyPlan(input)} frame={frame} />;
}
