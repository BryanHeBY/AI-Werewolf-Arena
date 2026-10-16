/**
 * 负责计算镜头、席位与连线共用的布局坐标。输入为席位名单、画幅与目标，输出席位锚点、字幕安全区和镜头姿态。
 * 本层仅计算几何，不决定事件语义或存活状态；字幕位于独立屏幕空间，不跟随取景变换。
 */
import type { CameraTarget, LayerPoint } from "./types";

export interface SeatAnchor {
  playerId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface VideoLayout {
  width: number;
  height: number;
  seats: SeatAnchor[];
  table: { x: number; y: number; width: number; height: number };
  caption: { x: number; y: number; width: number; height: number };
}
export function createVideoLayout(playerIds: number[], width = 1280, height = 720): VideoLayout {
  const scale = Math.min(width / 1280, height / 720);
  return {
    width,
    height,
    seats: playerIds.map((playerId, index) => {
      const angle = (Math.PI * 2 * index) / playerIds.length - Math.PI / 2;
      return {
        playerId,
        x: width * (0.5 + Math.cos(angle) * 0.355),
        y: height * (0.385 + Math.sin(angle) * 0.205),
        width: (playerIds.length >= 10 ? 150 : 114) * scale,
        height: (playerIds.length >= 10 ? 72 : 94) * scale,
      };
    }),
    table: { x: width * 0.5, y: height * 0.385, width: width * 0.34, height: height * 0.25 },
    caption: { x: width * 0.07, y: height * 0.7, width: width * 0.86, height: height * 0.23 },
  };
}
export function resolveLayerPoint(point: LayerPoint, layout: VideoLayout) {
  if (!("playerId" in point)) return { x: point.x, y: point.y };
  const seat = layout.seats.find((item) => item.playerId === point.playerId);
  if (!seat) throw new Error(`video_player_missing:${point.playerId}`);
  return { x: seat.x, y: seat.y };
}
export interface CameraPose {
  x: number;
  y: number;
  scale: number;
}
/** 默认聚焦自动框住多席位；显式 zoom 是相对于原场景的绝对倍率。 */
export function cameraTargetPose(
  target: CameraTarget,
  zoom: number | undefined,
  layout: VideoLayout,
): CameraPose {
  if (target === "table")
    return { x: layout.width / 2, y: layout.height * 0.385, scale: zoom ?? 1 };
  const seats = target.playerIds.map((playerId) => {
    const seat = layout.seats.find((item) => item.playerId === playerId);
    if (!seat) throw new Error(`video_player_missing:${playerId}`);
    return seat;
  });
  const left = Math.min(...seats.map((seat) => seat.x - seat.width / 2));
  const right = Math.max(...seats.map((seat) => seat.x + seat.width / 2));
  const top = Math.min(...seats.map((seat) => seat.y - seat.height / 2));
  const bottom = Math.max(...seats.map((seat) => seat.y + seat.height / 2));
  const fit = Math.min(
    2.5,
    (layout.width * 0.78) / (right - left),
    (layout.height * 0.43) / (bottom - top),
  );
  return { x: (left + right) / 2, y: (top + bottom) / 2, scale: zoom ?? fit };
}
