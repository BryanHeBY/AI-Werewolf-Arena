/**
 * 负责定义前端视频编排的数据契约，由视频模块拥有脚本、计划、镜头、图层和媒体字段。
 * 事件事实仍属于复盘契约；本文件只描述引用、时间与展示参数，不含规则或运行时回调。
 * 自定义 React 组件注册表与可序列化计划分开，避免组件实现进入 JSON 渲染输入。
 */
import type { ComponentType } from "react";
import type { buildReplayEventView } from "../replay/replay-event-view";
import type { ReplayDisplayOptions } from "../replay/replay-display";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type VideoEventView = ReturnType<typeof buildReplayEventView>;
export interface VideoSourceIdentity {
  sessionId: string;
  fingerprint: string;
}
/** seq 是原始归档序号，绝不是过滤后的数组位置。 */
export interface EventAnchor {
  seq: number;
  type: string;
}
export type CameraTarget = "table" | { playerIds: number[] };
export interface CameraKeyframe {
  frame: number;
  target: CameraTarget;
  zoom?: number;
  /** easing 描述从本关键帧驶向下一关键帧的插值。 */
  easing?: "linear" | "smooth" | "hold";
}
export type LayerPoint = { playerId: number } | { x: number; y: number };
interface LayerTiming {
  id: string;
  from?: number;
  durationFrames?: number;
  space?: "world" | "screen";
  zIndex?: number;
}
export type VideoLayer = LayerTiming &
  (
    | {
        kind: "text";
        text: string;
        x?: number;
        y?: number;
        width?: number;
        fontSize?: number;
        color?: string;
        background?: string;
      }
    | {
        kind: "arrow";
        fromTarget: LayerPoint;
        toTarget: LayerPoint;
        color?: string;
        strokeWidth?: number;
      }
    | { kind: "spotlight" | "highlight"; playerIds: number[]; color?: string; opacity?: number }
    | { kind: "flash"; color?: string; opacity?: number }
    | { kind: "shake"; intensity?: number; frequency?: number }
    | { kind: "custom"; component: string; props?: JsonObject }
  );
export type SpeakerId = "god" | `player:${number}`;
/** 预留配音脚本：text 独立于屏幕字幕；assetId 仅引用已经准备好的媒体，不发起 TTS。 */
export interface SpeechCue {
  speaker: SpeakerId;
  text: string;
  from?: number;
  durationFrames?: number;
  assetId?: string;
}
export interface MediaAsset {
  id: string;
  kind: "audio" | "image" | "video";
  src: string;
  durationFrames?: number;
  width?: number;
  height?: number;
}
export interface AudioCue {
  id: string;
  assetId: string;
  from: number;
  durationFrames?: number;
  offsetFrames?: number;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  track: "voice" | "music" | "sfx";
  speaker?: SpeakerId;
}
export interface ShotOptions {
  durationFrames?: number;
  caption?: string;
  camera?: CameraKeyframe[];
  layers?: VideoLayer[];
  speech?: SpeechCue[];
}
export interface VideoEventEdit extends ShotOptions {
  anchor: EventAnchor;
  skip?: boolean;
}
export interface VideoHold extends ShotOptions {
  id: string;
  after: EventAnchor;
  /** 可在当前位置插入回顾；状态始终从该原事件前缀取得。 */
  stateAt?: EventAnchor;
  durationFrames: number;
}
export interface VideoScript {
  source: VideoSourceIdentity;
  fps?: number;
  width?: number;
  height?: number;
  defaultEventFrames?: number;
  captionPageFrames?: number;
  seed?: number;
  edits?: VideoEventEdit[];
  holds?: VideoHold[];
  media?: MediaAsset[];
  audio?: AudioCue[];
}
export interface CompiledVideoLayer extends LayerTiming {
  from: number;
  durationFrames: number;
  space: "world" | "screen";
  zIndex: number;
}
export type PlannedVideoLayer = VideoLayer & CompiledVideoLayer;
export interface CompiledSpeechCue extends SpeechCue {
  from: number;
  durationFrames: number;
}
export interface VideoShot {
  id: string;
  kind: "event" | "hold";
  from: number;
  durationFrames: number;
  /** 原归档数组游标，保证跳剪不遗漏被跳过事件的状态影响。 */
  eventIndex: number;
  eventSeq: number | null;
  view: VideoEventView;
  captionPages: string[];
  camera: CameraKeyframe[];
  layers: PlannedVideoLayer[];
  speech: CompiledSpeechCue[];
}
export interface PlannedAudioCue extends AudioCue {
  durationFrames: number;
  offsetFrames: number;
  volume: number;
  fadeInFrames: number;
  fadeOutFrames: number;
}
export interface VideoPlan {
  version: 1;
  source: VideoSourceIdentity;
  display: ReplayDisplayOptions;
  fps: number;
  width: number;
  height: number;
  seed: number;
  durationFrames: number;
  shots: VideoShot[];
  media: MediaAsset[];
  audio: PlannedAudioCue[];
}
/** 注册表进入打包入口，plan 只保留组件名称和 JSON 属性。 */
export interface CustomVideoLayerProps {
  frame: number;
  durationFrames: number;
  shot: VideoShot;
  plan: VideoPlan;
  props: JsonObject;
  /** 本地准备素材的预览或导出基准；自定义组件通过 resolveVideoMediaSource 取得相同资源。 */
  mediaBaseUrl?: string;
}
export type VideoLayerRegistry = Record<string, ComponentType<CustomVideoLayerProps>>;
