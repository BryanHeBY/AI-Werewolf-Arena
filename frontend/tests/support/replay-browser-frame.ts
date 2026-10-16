/**
 * 浏览器集成测试支持层负责把旧固定时长的采样位置转换为当前默认视频帧。输入为原复盘、旧帧及显示选项，输出可写入滑块的新帧。
 * 只复用编排起点，不从新计划生成角色、存活、字幕或胜者预期；事实断言仍由调用方的原始 seq、手写内容或旧纯投影持有。
 * 旧事件尾帧映射到同一源 seq 状态区间末帧；新镜头可能在稍后的 settled 才揭晓另一事件，不能直接取整段末帧。
 * 其他采样从该源事件的揭晓帧起保持局部偏移，不把原 seq 当数组下标；事实预期仍保留旧纯 reader／字面断言。
 */
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { compileVideoPlan, type VideoPlan } from "../../src/video";
import { buildPresentationReplay } from "../../src/replay/replay-presentation";
import { FRAMES_PER_EVENT } from "../../src/replay/replay-frame";
import type { ReplayDisplayOptions } from "../../src/replay/replay-display";

const plans = new WeakMap<ReplayDocument, Map<string, VideoPlan>>();

/** 计划只作为浏览器导航元数据缓存，调用方不得以计划的文案或事实替代独立预期。 */
export function replayBrowserPlan(
  replay: ReplayDocument,
  display: ReplayDisplayOptions,
): VideoPlan {
  const key = `${display.locale}:${display.timeZone}`;
  let versions = plans.get(replay);
  if (!versions) {
    versions = new Map();
    plans.set(replay, versions);
  }
  let plan = versions.get(key);
  if (!plan) {
    plan = compileVideoPlan(replay, undefined, display);
    versions.set(key, plan);
  }
  return plan;
}

export function replayBrowserFrame(
  replay: ReplayDocument,
  legacyFrame: number,
  display: ReplayDisplayOptions,
): number {
  if (!Number.isSafeInteger(legacyFrame) || legacyFrame < 0)
    throw new Error("browser_legacy_sample_invalid");
  const plan = replayBrowserPlan(replay, display);
  const presentation = buildPresentationReplay(replay);
  if (!presentation.events.length) return 0;
  const index = Math.min(
    Math.floor(legacyFrame / FRAMES_PER_EVENT),
    presentation.events.length - 1,
  );
  const seq = presentation.events[index]!.seq;
  const shot = plan.shots.find((item) => item.kind === "event" && item.sourceSeqs.includes(seq));
  if (!shot) throw new Error(`browser_legacy_sample_event_missing:${seq}`);
  const cueIndex = shot.stateCues.findIndex((cue) => cue.throughSeq >= seq);
  if (cueIndex < 0) throw new Error(`browser_legacy_sample_reveal_missing:${seq}`);
  const start = shot.stateCues[cueIndex]!.frame;
  const end = (shot.stateCues[cueIndex + 1]?.frame ?? shot.durationFrames) - 1;
  const offset = legacyFrame % FRAMES_PER_EVENT;
  return shot.from + (offset === FRAMES_PER_EVENT - 1 ? end : Math.min(start + offset, end));
}
