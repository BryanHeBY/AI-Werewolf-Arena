/**
 * 负责定义前端视频编排的数据契约，由视频模块拥有脚本、计划、镜头、图层和媒体字段。
 * 事件事实仍属于复盘契约；本文件只描述引用、时间与展示参数，不含规则或运行时回调。
 * 自定义 React 组件注册表与可序列化计划分开，避免组件实现进入 JSON 渲染输入。
 */
import type { ComponentType } from "react";
import type { buildReplayEventView } from "../replay/replay-event-view";
import type { ReplayDisplayOptions } from "../replay/replay-display";
import type { ThemeSelection, ResolvedTheme } from "../themes";
import type { PlayerPresentationConfig, ResolvedPlayerPresentation } from "../presentation";
import type { ReplayFact } from "@ai-werewolf-arena/replay-contract";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type VideoEventView = ReturnType<typeof buildReplayEventView>;
export type VideoLayoutId = "legacy-ellipse-v1" | "broadcast-v1";
export type VideoThemeSelection = ThemeSelection;
export interface TextEmphasis {
  text: string;
  /** 从0开始；范围使用JavaScript字符串下标，供渲染器按同一正文切片。 */
  occurrence?: number;
}
export interface CompiledTextEmphasis {
  text: string;
  start: number;
  end: number;
}
export interface VideoSceneCues {
  establish: number;
  travel: number;
  impact: number;
  settled: number;
}
export interface VideoBallot {
  kind: "exile" | "sheriff" | "wolf";
  round?: number;
  votes: Array<{
    actorId: number;
    targetId: number | null;
    abstain: boolean;
    weight: number | null;
    fallback?: boolean;
  }>;
  tally: Record<string, number> | null;
  targetId: number | null;
  adjustments: Array<{ kind: "crow"; targetId: number; weight: number; sourceSeq: number }>;
  complete: boolean;
}
export interface VideoScene {
  kind: "speech" | "action" | "ballot" | "settlement" | "phase" | "fallback";
  title: string;
  body: string;
  bodySource: "event" | "script";
  speaker?: SpeakerId;
  actorId?: number;
  targetIds: number[];
  participantIds?: number[];
  stock?: { actorId: number; abilityId: string; heal: number; poison: number };
  /** 同段后续记录的独立结果；揭晓不替代life_committed的生命提交。 */
  resolution?: { text: string; targetId?: number; revealFrame: number };
  action?: {
    kind:
      | "wolf-vote"
      | "wolf-knife"
      | "inspect"
      | "heal"
      | "poison"
      | "guard"
      | "exile"
      | "protection"
      | "generic";
    status: "choice" | "committed" | "recorded" | "revoked" | "unknown";
    result?: string;
  };
  ballot?: VideoBallot;
  emphasis: CompiledTextEmphasis[];
  cues: VideoSceneCues;
}
export type VideoSceneOverride = Partial<
  Pick<VideoScene, "kind" | "title" | "body" | "speaker" | "actorId" | "targetIds">
> & { cues?: Partial<VideoSceneCues> };
export interface VideoSourceIdentity {
  sessionId: string;
  fingerprint: string;
}
/** seq 是原始归档序号，绝不是过滤后的数组位置。 */
export interface EventAnchor {
  seq: number;
  type: string;
}
/** 独立事实使用自己的seq/kind，不能与原事件seq/type混用。 */
export interface FactAnchor {
  seq: number;
  kind: ReplayFact["kind"];
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
  scene?: VideoSceneOverride;
  emphasis?: TextEmphasis[];
}
export interface VideoEventEdit extends ShotOptions {
  anchor: EventAnchor;
  skip?: boolean;
}
export interface VideoFactEdit extends ShotOptions {
  anchor: FactAnchor;
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
  layout?: VideoLayoutId;
  theme?: VideoThemeSelection;
  presentation?: PlayerPresentationConfig;
  fps?: number;
  width?: number;
  height?: number;
  defaultEventFrames?: number;
  captionPageFrames?: number;
  seed?: number;
  edits?: VideoEventEdit[];
  factEdits?: VideoFactEdit[];
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
  /** 各页在未改写正文中的UTF16起点，重复页也能精确定位文字重点。 */
  captionPageOffsets: number[];
  camera: CameraKeyframe[];
  layers: PlannedVideoLayer[];
  speech: CompiledSpeechCue[];
  sourceSeqs: number[];
  sourceFacts: number[];
  scene: VideoScene;
  stateCues: Array<{
    frame: number;
    throughSeq: number;
    throughFactSeq: number;
    view: VideoEventView;
  }>;
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
  layout: VideoLayoutId;
  theme: ResolvedTheme;
  playersPresentation: ResolvedPlayerPresentation[];
  eventFrames: Record<
    string,
    Array<{ shotId: string; frame: number; mode: "primary" | "absorbed" | "revisit" }>
  >;
  fonts?: Array<{ family: string; src: string; weight?: string }>;
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
  currentView?: VideoEventView;
  scene?: VideoScene;
  sourceSeq?: number;
  sourceFactSeq?: number;
}
export type VideoLayerRegistry = Record<string, ComponentType<CustomVideoLayerProps>>;
