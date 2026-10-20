/** 负责配音后的视觉时间约束。输入为原镜头、目标时长与台词锚点，输出重排镜头；短特效默认固定长度，不按长配音隐式拉伸。 */
import type { VideoShot, VideoTimeConstraint } from "./video/types";

export function retimeSpeechVisuals(
  shot: VideoShot,
  durationFrames: number,
  anchors: Record<string, number>,
) {
  const ratio = durationFrames / shot.durationFrames;
  const position = (frame: number, clock?: VideoTimeConstraint) => {
    const anchor = clock?.anchor ?? "start";
    if (
      anchors[anchor] === undefined ||
      (clock?.position !== undefined && !["fixed", "stretch"].includes(clock.position)) ||
      (clock?.duration !== undefined && !["fixed", "stretch"].includes(clock.duration))
    )
      throw new Error("speech_visual_clock_invalid");
    return Math.max(
      0,
      Math.min(
        durationFrames - 1,
        anchors[anchor]! + Math.round(frame * (clock?.position === "stretch" ? ratio : 1)),
      ),
    );
  };
  const camera = [
    ...new Map(
      shot.camera.map((key) => {
        const frame = position(key.frame, key.clock);
        return [frame, { ...key, frame }] as const;
      }),
    ).values(),
  ].sort((a, b) => a.frame - b.frame);
  const layers = shot.layers.map((layer) => {
    const from = position(layer.from, layer.clock);
    return {
      ...layer,
      from,
      durationFrames: Math.min(
        durationFrames - from,
        Math.max(
          1,
          Math.round(layer.durationFrames * (layer.clock?.duration === "stretch" ? ratio : 1)),
        ),
      ),
    };
  });
  return { camera, layers };
}
