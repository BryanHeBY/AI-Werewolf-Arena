/**
 * 负责计算镜头、席位与连线共用的布局坐标。输入为席位名单、画幅与目标，输出席位锚点、字幕安全区和镜头姿态。
 * 本层仅计算几何，不决定事件语义或存活状态；字幕位于独立屏幕空间，不跟随取景变换。
 */
import type { CameraTarget, LayerPoint, VideoLayoutId } from "./types";
import type { ResolvedPlayerPresentation } from "../presentation";

export interface VideoLayoutOptions {
  /** 只消费整局已完成匿名／显隐裁剪的资料；省略时保持旧广播几何，不从原始姓名或当前事件反推。 */
  playersPresentation?: readonly Pick<
    ResolvedPlayerPresentation,
    "playerId" | "displayName" | "modelLabel"
  >[];
}

export interface SeatAnchor {
  playerId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface VideoLayout {
  id: VideoLayoutId;
  width: number;
  height: number;
  seats: SeatAnchor[];
  table: { x: number; y: number; width: number; height: number };
  caption: { x: number; y: number; width: number; height: number };
  stage: { x: number; y: number; width: number; height: number };
  rosterLeft: SeatAnchor[];
  rosterRight: SeatAnchor[];
  rosterColumns: {
    left: { width: number; hasMetadata: boolean };
    right: { width: number; hasMetadata: boolean };
  };
}
export function createVideoLayout(
  playerIds: number[],
  width = 1280,
  height = 720,
  id: VideoLayoutId = "legacy-ellipse-v1",
  options: VideoLayoutOptions = {},
): VideoLayout {
  const scale = Math.min(width / 1280, height / 720);
  if (id === "broadcast-v1") {
    const rows = Math.ceil(playerIds.length / 2);
    const metadata =
      options.playersPresentation === undefined
        ? undefined
        : new Map(
            options.playersPresentation.map((player) => [
              player.playerId,
              Boolean(player.displayName?.trim() || player.modelLabel?.trim()),
            ]),
          );
    const column = (ids: number[]) => {
      const hasMetadata =
        metadata === undefined || ids.some((playerId) => metadata.get(playerId) === true);
      // 紧凑列仍容纳头像、编号与最长语言的角色标签；列宽整局固定，与生死、说话和焦点无关。
      return { width: width * (hasMetadata ? 0.171 : 0.125), hasMetadata };
    };
    const rosterColumns = {
      left: column(playerIds.slice(0, rows)),
      right: column(playerIds.slice(rows)),
    };
    const leftReclaimed = width * 0.171 - rosterColumns.left.width;
    const rightReclaimed = width * 0.171 - rosterColumns.right.width;
    const gap = height * 0.011;
    const cardHeight = Math.min(
      height * 0.122,
      (height * 0.8 - Math.max(0, rows - 1) * gap) / Math.max(1, rows),
    );
    const seats = playerIds.map((playerId, index) => ({
      playerId,
      x: index < rows ? width * 0.105 - leftReclaimed / 2 : width * 0.895 + rightReclaimed / 2,
      y: height * 0.16 + cardHeight / 2 + (index % rows) * (cardHeight + gap),
      width: index < rows ? rosterColumns.left.width : rosterColumns.right.width,
      height: cardHeight,
    }));
    const stage = {
      x: width * 0.205 - leftReclaimed,
      y: height * 0.145,
      width: width * 0.59 + leftReclaimed + rightReclaimed,
      height: height * 0.775,
    };
    return {
      id,
      width,
      height,
      seats,
      rosterLeft: seats.slice(0, rows),
      rosterRight: seats.slice(rows),
      rosterColumns,
      stage,
      table: {
        x: stage.x + stage.width / 2,
        y: height * 0.48,
        width: stage.width,
        height: stage.height * 0.7,
      },
      caption: {
        x: stage.x + stage.width * 0.04,
        y: height * 0.72,
        width: stage.width * 0.92,
        height: height * 0.185,
      },
    };
  }
  const seats = playerIds.map((playerId, index) => {
    const angle = (Math.PI * 2 * index) / playerIds.length - Math.PI / 2;
    return {
      playerId,
      x: width * (0.5 + Math.cos(angle) * 0.355),
      y: height * (0.385 + Math.sin(angle) * 0.205),
      width: (playerIds.length >= 10 ? 150 : 114) * scale,
      height: (playerIds.length >= 10 ? 72 : 94) * scale,
    };
  });
  return {
    id,
    width,
    height,
    seats,
    rosterLeft: [],
    rosterRight: [],
    rosterColumns: {
      left: { width: 0, hasMetadata: false },
      right: { width: 0, hasMetadata: false },
    },
    stage: { x: width * 0.07, y: height * 0.12, width: width * 0.86, height: height * 0.54 },
    table: { x: width * 0.5, y: height * 0.385, width: width * 0.34, height: height * 0.25 },
    caption: { x: width * 0.07, y: height * 0.7, width: width * 0.86, height: height * 0.23 },
  };
}
export function resolveLayerPoint(point: LayerPoint, layout: VideoLayout) {
  if (!("playerId" in point)) return { x: point.x, y: point.y };
  const seat = layout.seats.find((item) => item.playerId === point.playerId);
  if (!seat) throw new Error(`video_player_missing:${point.playerId}`);
  return { x: seat.x, y: seat.y, ...(layout.id === "broadcast-v1" ? { fixed: true } : {}) };
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
  // 广播布局的席位属于固定 HUD，玩家聚焦只选择中央人物，不移动两侧栏。
  if (layout.id === "broadcast-v1")
    return {
      x: layout.stage.x + layout.stage.width / 2,
      y: layout.stage.y + layout.stage.height / 2,
      scale: zoom ?? (target === "table" ? 1 : 1.12),
    };
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
