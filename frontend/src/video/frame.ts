/**
 * 负责将视频帧定位到预编译镜头。输入为纯数据计划和显式帧号，输出事件视图、字幕页、镜头矩阵与生效图层。
 * 查询支持暂停、倒看和任意跳转，不逐帧扫描事件前缀，不累加或修改游戏状态；音量也由局部帧直接计算。
 */
import { cameraTargetPose, createVideoLayout, type CameraPose, type VideoLayout } from "./layout";
import type { CameraKeyframe, PlannedAudioCue, VideoPlan, VideoShot } from "./types";
import { videoCaptionRange } from "./captions";

function cameraAt(
  keys: CameraKeyframe[],
  frame: number,
  layout: VideoLayout,
): { pose: CameraPose; focusPlayerIds: number[] } {
  let index = 0;
  while (index + 1 < keys.length && keys[index + 1].frame <= frame) index++;
  const key = keys[index],
    next = keys[index + 1];
  const first = cameraTargetPose(key.target, key.zoom, layout);
  const focusPlayerIds = key.target === "table" ? [] : [...key.target.playerIds];
  if (!next) return { pose: first, focusPlayerIds };
  const last = cameraTargetPose(next.target, next.zoom, layout);
  let t = (frame - key.frame) / (next.frame - key.frame);
  if (key.easing === "hold") t = 0;
  else if ((key.easing ?? "smooth") === "smooth") t = t * t * (3 - 2 * t);
  return {
    pose: {
      x: first.x + (last.x - first.x) * t,
      y: first.y + (last.y - first.y) * t,
      scale: first.scale + (last.scale - first.scale) * t,
    },
    focusPlayerIds,
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
  const state = [...shot.stateCues].reverse().find((cue) => cue.frame <= localFrame)!;
  const currentView = state.view;
  const layout = createVideoLayout(
    plan.layout === "broadcast-v1"
      ? plan.playersPresentation.map((player) => player.playerId)
      : shot.view.players.map((player) => player.playerId),
    plan.width,
    plan.height,
    plan.layout,
    { playersPresentation: plan.playersPresentation },
  );
  const { pose: camera, focusPlayerIds } = cameraAt(shot.camera, localFrame, layout);
  const captionRange = videoCaptionRange(plan.layout, shot.scene, shot.durationFrames);
  const captionPageIndex = Math.min(
    shot.captionPages.length - 1,
    Math.floor(
      (Math.max(0, localFrame - captionRange.from) * shot.captionPages.length) /
        captionRange.durationFrames,
    ),
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
  const origin =
    plan.layout === "broadcast-v1"
      ? { x: layout.stage.x + layout.stage.width / 2, y: layout.stage.y + layout.stage.height / 2 }
      : { x: plan.width / 2, y: plan.height * 0.385 };
  const translateX = origin.x - camera.x * camera.scale + shakeX;
  const translateY = origin.y - camera.y * camera.scale + shakeY;
  const stageOffset = {
    x: (origin.x - camera.x) * camera.scale + shakeX,
    y: (origin.y - camera.y) * camera.scale + shakeY,
  };
  return {
    frame,
    localFrame,
    shotIndex,
    shot,
    currentView,
    scene: shot.scene,
    sourceSeq: state.throughSeq,
    sourceFactSeq: state.throughFactSeq,
    cue:
      localFrame < shot.scene.cues.travel
        ? ("establish" as const)
        : localFrame < shot.scene.cues.impact
          ? ("travel" as const)
          : localFrame < shot.scene.cues.settled
            ? ("impact" as const)
            : ("settled" as const),
    layout,
    camera,
    /** 当前关键帧明确选定的中央人物，插值阶段仍保持来源关键帧目标；HUD几何不随此名单移动。 */
    focusPlayerIds,
    activeLayers,
    captionPageIndex,
    captionRange,
    captionOffset: shot.captionPageOffsets[captionPageIndex] ?? 0,
    caption: shot.captionPages[captionPageIndex] ?? "",
    translation: { x: translateX, y: translateY },
    transform: `translate(${translateX}px, ${translateY}px) scale(${camera.scale})`,
    /** 中央图形以stage中心为transform-origin时使用，与画布world矩阵包含同一平移／震动；HUD与字幕不继承。 */
    stageTransform: `translate(${stageOffset.x}px, ${stageOffset.y}px) scale(${camera.scale})`,
  };
}
export type VideoFrameView = ReturnType<typeof buildVideoFrame>;
/** 屏幕图层仍可引用席位锚点，几何目标跟随镜头，显式屏幕坐标保持固定。 */
export function videoWorldToScreen(
  point: { x: number; y: number; fixed?: boolean },
  view: VideoFrameView,
) {
  // 广播席位是HUD，不受中央舞台镜头影响；显式舞台坐标仍使用下方变换。
  if (point.fixed) return { x: point.x, y: point.y };
  return {
    x: point.x * view.camera.scale + view.translation.x,
    y: point.y * view.camera.scale + view.translation.y,
  };
}
/** 原事件定位到该段的事实生效帧；被聚合的明细可定位，被跳剪且仅回顾的事件仍返回 null。 */
export function getVideoEventFrame(plan: VideoPlan, seq: number): number | null {
  return plan.eventFrames[String(seq)]?.find((item) => item.mode !== "revisit")?.frame ?? null;
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
