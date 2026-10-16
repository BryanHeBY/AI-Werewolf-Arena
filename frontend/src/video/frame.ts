/**
 * 负责将视频帧定位到预编译镜头。输入为纯数据计划和显式帧号，输出事件视图、字幕页、镜头矩阵与生效图层。
 * 查询支持暂停、倒看和任意跳转，不逐帧扫描事件前缀，不累加或修改游戏状态；音量也由局部帧直接计算。
 */
import { cameraTargetPose, createVideoLayout, type CameraPose, type VideoLayout } from "./layout";
import type { CameraKeyframe, PlannedAudioCue, VideoPlan, VideoShot } from "./types";

function cameraAt(keys: CameraKeyframe[], frame: number, layout: VideoLayout): CameraPose {
  let index = 0;
  while (index + 1 < keys.length && keys[index + 1].frame <= frame) index++;
  const key = keys[index],
    next = keys[index + 1];
  const first = cameraTargetPose(key.target, key.zoom, layout);
  if (!next) return first;
  const last = cameraTargetPose(next.target, next.zoom, layout);
  let t = (frame - key.frame) / (next.frame - key.frame);
  if (key.easing === "hold") t = 0;
  else if ((key.easing ?? "smooth") === "smooth") t = t * t * (3 - 2 * t);
  return {
    x: first.x + (last.x - first.x) * t,
    y: first.y + (last.y - first.y) * t,
    scale: first.scale + (last.scale - first.scale) * t,
  };
}
function findShot(plan: VideoPlan, frame: number): number {
  let low = 0,
    high = plan.shots.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (plan.shots[middle].from <= frame) low = middle;
    else high = middle - 1;
  }
  return low;
}
export function buildVideoFrame(plan: VideoPlan, requestedFrame: number) {
  if (!Number.isSafeInteger(requestedFrame) || requestedFrame < 0)
    throw new Error("video_frame_invalid");
  if (!plan.shots.length || plan.durationFrames < 1) throw new Error("video_plan_empty");
  const frame = Math.min(requestedFrame, plan.durationFrames - 1);
  const shotIndex = findShot(plan, frame);
  const shot = plan.shots[shotIndex];
  const localFrame = frame - shot.from;
  const layout = createVideoLayout(
    shot.view.players.map((player) => player.playerId),
    plan.width,
    plan.height,
  );
  const camera = cameraAt(shot.camera, localFrame, layout);
  const captionPageIndex = Math.min(
    shot.captionPages.length - 1,
    Math.floor((localFrame * shot.captionPages.length) / shot.durationFrames),
  );
  const activeLayers = shot.layers.filter(
    (layer) => localFrame >= layer.from && localFrame < layer.from + layer.durationFrames,
  );
  let shakeX = 0,
    shakeY = 0;
  for (const layer of activeLayers)
    if (layer.kind === "shake") {
      const age = localFrame - layer.from;
      const phase = (age / plan.fps) * (layer.frequency ?? 10) * Math.PI * 2 + plan.seed * 0.017;
      const envelope = 1 - age / layer.durationFrames;
      shakeX += Math.sin(phase) * (layer.intensity ?? 8) * envelope;
      shakeY += Math.sin(phase * 1.37 + 1.3) * (layer.intensity ?? 8) * envelope;
    }
  const translateX = plan.width / 2 - camera.x * camera.scale + shakeX;
  const translateY = plan.height * 0.385 - camera.y * camera.scale + shakeY;
  return {
    frame,
    localFrame,
    shotIndex,
    shot,
    layout,
    camera,
    activeLayers,
    captionPageIndex,
    caption: shot.captionPages[captionPageIndex] ?? "",
    translation: { x: translateX, y: translateY },
    transform: `translate(${translateX}px, ${translateY}px) scale(${camera.scale})`,
  };
}
export type VideoFrameView = ReturnType<typeof buildVideoFrame>;
/** 屏幕图层仍可引用席位锚点，几何目标跟随镜头，显式屏幕坐标保持固定。 */
export function videoWorldToScreen(point: { x: number; y: number }, view: VideoFrameView) {
  return {
    x: point.x * view.camera.scale + view.translation.x,
    y: point.y * view.camera.scale + view.translation.y,
  };
}
/** 事件定位只匹配原 seq；被跳剪的事件返回 null，避免跳到相邻事件。 */
export function getVideoEventFrame(plan: VideoPlan, seq: number): number | null {
  return plan.shots.find((shot) => shot.kind === "event" && shot.eventSeq === seq)?.from ?? null;
}
export function videoShotEnd(shot: VideoShot): number {
  return shot.from + shot.durationFrames;
}
export function audioCueVolume(cue: PlannedAudioCue, frame: number): number {
  if (frame < 0 || frame >= cue.durationFrames) return 0;
  const fadeIn = cue.fadeInFrames ? Math.min(1, frame / cue.fadeInFrames) : 1;
  const fadeOut = cue.fadeOutFrames
    ? Math.min(1, (cue.durationFrames - 1 - frame) / cue.fadeOutFrames)
    : 1;
  return cue.volume * Math.max(0, Math.min(fadeIn, fadeOut));
}
export function resolveVideoMediaSource(src: string, baseUrl?: string): string {
  if (!baseUrl || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(src)) return src;
  if (/^[a-z][a-z\d+.-]*:/i.test(baseUrl))
    return new URL(src, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).href;
  return `${baseUrl.replace(/\/?$/, "/")}${src}`;
}
