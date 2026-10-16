/**
 * 负责把显式场景节拍映射为有限的美术动画包络。输入为局部整数帧和编译后的cue，输出纯数值，不持有时钟或上一帧。
 * 本层只移动装饰，不推进事实；settled后固定为同一末态，字幕和HUD不消费这里的位移。
 */
import type { VideoSceneCues } from "./types";

const unit = (value: number) => Math.max(0, Math.min(1, value));
export function sceneMotion(
  frame: number,
  cues: VideoSceneCues,
  options: { reduced?: boolean; enterDistance?: number; impactOpacity?: number } = {},
) {
  const enter =
    cues.travel <= cues.establish
      ? 1
      : unit((frame - cues.establish) / (cues.travel - cues.establish));
  const travel =
    cues.impact <= cues.travel ? 1 : unit((frame - cues.travel) / (cues.impact - cues.travel));
  const revealed = frame >= cues.impact;
  const stopped = frame >= cues.settled;
  // 冲击只在真实揭晓以后出现，且必在settled前收束；不串接新的余痕时钟。
  // 使用已编译cue间距的比例：30/60fps或作者自定节拍共享同一包络，不再暗藏固定12帧时钟。
  const span = Math.max(0, (cues.settled - cues.impact) * 0.75);
  const pulse =
    !options.reduced && revealed && !stopped && span > 0
      ? Math.sin(Math.PI * unit((frame - cues.impact) / span))
      : 0;
  return {
    revealed,
    stopped,
    opacity: options.reduced ? 1 : 0.85 + enter * 0.15,
    enterY: options.reduced ? 0 : (1 - enter) * (options.enterDistance ?? 6),
    pathProgress: options.reduced ? (revealed ? 1 : 0) : travel,
    impactOpacity: pulse * (options.impactOpacity ?? 0.22),
  };
}
