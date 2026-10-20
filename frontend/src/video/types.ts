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
import type { GameOutcome, RoleId } from "@ai-werewolf-arena/game-contract";
import type { VideoFrameView } from "./frame";
import type { SceneContent } from "../presentation/scene-content";
import type { VideoVisualFamily, VideoVisualTemplate } from "./visual-vocabulary";
import type { SpeechTextTiming } from "../speech-timing";
export type { VideoVisualFamily, VideoVisualTemplate } from "./visual-vocabulary";

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
  /** 显式文字色使用六位十六进制；缺省沿用当前场景强调色。 */
  color?: string;
}
export interface CompiledTextEmphasis {
  text: string;
  start: number;
  end: number;
  color?: string;
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
/** 只表示当时报告的揭示范围；不能据此推算真实身份、原生能力来源或单个双查目标。 */
export type VideoVisualReport =
  | { kind: "camp"; camp: "good" | "wolf" | "third_party" }
  | { kind: "role"; roleId: RoleId }
  | { kind: "combined"; camp: "good" | "wolf" | "third_party"; roleId: RoleId }
  | { kind: "pair"; targetIds: number[]; containsWerewolf: boolean }
  | { kind: "range"; signal: "roar" | "quiet"; scope: "adjacent_alive" }
  | { kind: "unknown"; reason: string };
/** 展示意图是纯数据；显式路由只选版式，不授予规则权限、不根据事件名字尾推成功。 */
export interface VideoVisualIntent {
  family: VideoVisualFamily;
  template: VideoVisualTemplate;
  process:
    | "notice"
    | "choice"
    | "used"
    | "paid"
    | "reported"
    | "blocked"
    | "revoked"
    | "expired"
    | "resolved"
    | "skipped"
    | "suppressed"
    | "unknown";
  actorId?: number;
  /** 反射等契约明示的原效果施法者；与机制actor分开，不反推原生角色或隐藏赠予者。 */
  effectSourceId?: number;
  effectKind?: "check" | "guard" | "poison";
  requestedTargetIds: number[];
  effectiveTargetIds: number[];
  /** true且数组为空表示明确的空落点；不能回退请求目标伪造实际命中。 */
  effectiveTargetKnown?: boolean;
  recipientIds: number[];
  participantIds?: number[];
  report?: VideoVisualReport;
  potion?: "heal" | "poison";
  /** 只由明确工具事实选择道具；通用死亡行动阻断无来源时留空，不反推原生枪或爪。 */
  deathTool?: "gun" | "claw" | "patrol" | "retaliation";
  /** 三种机制共享对决家族但不共享武器、许可或结果；按具体事件契约区分。 */
  duelKind?: "knight" | "awakened_knight" | "demon_hunter";
  protection?: {
    interaction: "guard_heal_cancelled" | "wolf_attack_blocked";
    kind?: "guard" | "heal";
  };
  /** branch是本条报告/尝试分支，不是从当前生命或真实角色推断；resolved可只有已记录死者。 */
  duel?: { branch?: "wolf" | "not_wolf" | "good"; chain?: number; recordedDeaths?: number[] };
  dialogue?: {
    kind:
      "speech" | "private" | "collaboration" | "translation" | "gesture" | "revealed" | "end_chat";
    originalSpeakerId?: number;
    round?: number;
  };
  /** 只有真实生命提交或旧档明确死亡事件可提供；不是技能命中目标。 */
  life?: {
    playerIds: number[];
    committed: boolean;
    causes?: Record<string, string[]>;
    waveId?: number;
  };
  victory?: {
    winningPlayerIds: number[];
    winner?: string | null;
    reason?: string;
    outcome?: GameOutcome;
  };
  /** 原事件和God事实保持独立序号；事实afterSeq另由stateCue负责前缀。 */
  source: { eventSeqs: number[]; factSeqs: number[] };
  /** 请求窗口只提供章节样式，不改变本条事件的动作家族或赋予行动权。 */
  window?: {
    id: string;
    known: boolean;
    family?: VideoVisualFamily;
    template?: VideoVisualTemplate;
  };
  fallbackReason?: string;
}
export interface VideoOpeningCredits {
  repository: string;
  model?: string;
  agent: string;
  features?: string[];
  description?: string;
}
export interface VideoScene {
  /** 片头标题直接排在原生舞台，不创建上帝播报卡片。 */
  textLayout?: "title";
  /** 片头署名只作画面展示，不自动加入台词或参与游戏事实。 */
  credits?: VideoOpeningCredits;
  /** 阶段正文之后的次要说明独立排小字，不自动加入配音。 */
  notes?: { title: string; body: string };
  kind: "speech" | "action" | "ballot" | "settlement" | "phase" | "fallback";
  title: string;
  body: string;
  bodySource: "event" | "script";
  bodyLayout?: "structured" | "text";
  speaker?: SpeakerId;
  actorId?: number;
  targetIds: number[];
  participantIds?: number[];
  content?: SceneContent;
  /** 库存是已记录资源上下文，不代表当轮可用；缺证据或多实例歧义保持 unknown。 */
  inventory?: { before: PotionInventoryState; after: PotionInventoryState; revealFrame: number };
  stock?: { actorId: number; abilityId: string; heal: number; poison: number };
  /** 同段后续记录的独立结果；揭晓不替代life_committed的生命提交。 */
  resolution?: {
    text: string;
    targetId?: number;
    revealFrame: number;
    reading?: VideoReading;
    /** 后续正式计票保留在自己的揭晓节点，不能提前并入summary票型。 */
    ballot?: VideoBallot;
  };
  /** 内建旧场景及已准备计划的展示兼容字段；本地化 result 不供选材或事实推断，结构化报告归 visual。 */
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
  visual?: VideoVisualIntent;
  /** 导演明确的展示标注独立于记录的请求/效果目标，不覆盖事实或赋予技能。 */
  editorial?: { targetIds?: number[]; actorId?: number };
}
export type VideoSceneOverride = Partial<
  Pick<
    VideoScene,
    | "kind"
    | "title"
    | "body"
    | "bodySource"
    | "bodyLayout"
    | "speaker"
    | "actorId"
    | "targetIds"
    | "textLayout"
    | "credits"
    | "notes"
  >
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
export interface VideoTimeConstraint {
  anchor?: "start" | "impact" | "result" | "end" | `speech:${string}`;
  position?: "fixed" | "stretch";
  duration?: "fixed" | "stretch";
}
export interface CameraKeyframe {
  clock?: VideoTimeConstraint;
  frame: number;
  target: CameraTarget;
  zoom?: number;
  /** easing 描述从本关键帧驶向下一关键帧的插值。 */
  easing?: "linear" | "smooth" | "hold";
}
export type LayerPoint = { playerId: number } | { x: number; y: number };
interface LayerTiming {
  /** 配音重排时起点锚定与持续时间分别处理；未设置时保留短动画的固定帧长。 */
  clock?: VideoTimeConstraint;
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
export type SpeakerId = "narrator" | "god" | `player:${number}`;
/** 预留配音脚本：text 独立于屏幕字幕；assetId 仅引用已经准备好的媒体，不发起 TTS。 */
export interface SpeechCue {
  speaker: SpeakerId;
  text: string;
  from?: number;
  durationFrames?: number;
  assetId?: string;
  /** 字幕时间相对于本段配音起点，单位毫秒；镜头平移不修改这些边界。 */
  subtitles?: SpeechTextTiming[];
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
  /** 仅新广播自动发言全文窗可用；逐段完整覆盖全局，显式分页/时长与hold保旧约定。 */
  speechReading?: VideoSpeechReadingOptions;
  /** 已备语音或导演显式时长仍使用全文阅读窗，不退回旧分页。 */
  readingClock?: "flow";
  scene?: VideoSceneOverride;
  emphasis?: TextEmphasis[];
}
export interface VideoEventEdit extends ShotOptions {
  /** 只允许在事件入口合并同前缀、同死亡波的权威生命提交。 */
  lifeFacts?: Array<FactAnchor & { kind: "life_committed" }>;
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
/** 开场使用事件发生前的初始视图；不借用第一事件或未来底牌。 */
export interface VideoIntro extends ShotOptions {
  id: string;
  durationFrames: number;
}
export interface VideoSubtitleDisplayOptions {
  /** 仅延长显示尾部，遇下一条字幕或片尾立即截止，不修改原始语音时间。 */
  lingerMs?: number;
}
export interface VideoScript {
  source: VideoSourceIdentity;
  program?: { title: string; subtitle?: string };
  maxDurationFrames?: number;
  layout?: VideoLayoutId;
  theme?: VideoThemeSelection;
  presentation?: PlayerPresentationConfig;
  fps?: number;
  width?: number;
  height?: number;
  defaultEventFrames?: number;
  captionPageFrames?: number;
  /** 无脚本预览默认旁白节奏；旧显式脚本保留阅读预算，可主动选择紧凑自动场景。 */
  pacing?: "narration" | "reading";
  speechReading?: VideoSpeechReadingOptions;
  seed?: number;
  edits?: VideoEventEdit[];
  factEdits?: VideoFactEdit[];
  holds?: VideoHold[];
  intro?: VideoIntro[];
  /** 在原生语义合段之后微调稳定镜头ID，不因修改配音而拆散票型或结算。 */
  shotEdits?: Array<ShotOptions & { id: string }>;
  media?: MediaAsset[];
  audio?: AudioCue[];
  subtitles?: VideoSubtitleDisplayOptions;
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
/** 仅消费已记录的库存事实，不按角色初始值或用药事件推减数量。 */
export type PotionInventoryState =
  | { status: "unknown"; actorId: number; abilityId?: string }
  | {
      status: "known";
      actorId: number;
      abilityId: string;
      heal: number;
      poison: number;
      sourceFactSeq: number;
      afterSeq: number;
      day: number;
    };
/** 发言阅读只选择位移方式；实际行边界由固定字体就绪后的渲染器测量，不参与事实或语音调度。 */
export interface VideoSpeechReadingOptions {
  motion: "line" | "continuous" | "static";
  /** 逐行推进的短过渡上限，渲染器还需限制到每行周期的30%；缺省为0.15秒换算的整数帧。 */
  transitionFrames?: number;
}
/** 新全文阅读的确定性时钟；旧计划缺省motion仍为连续滚动，缺省reading仍使用captionPageRanges。 */
export interface VideoReading {
  version: 1;
  mode: "flow";
  from: number;
  durationFrames: number;
  headHoldFrames: number;
  tailHoldFrames: number;
  motion?: VideoSpeechReadingOptions["motion"];
  transitionFrames?: number;
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
  /** 自动阅读保首屏落定后足额静止；旧计划缺省时仍走整段均分页兼容。 */
  captionPageRanges?: Array<{ from: number; durationFrames: number }>;
  reading?: VideoReading;
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
export interface PlannedSubtitleCue {
  id: string;
  speaker: SpeakerId;
  text: string;
  from: number;
  durationFrames: number;
}
export interface VideoPlan {
  version: 1;
  source: VideoSourceIdentity;
  program?: { title: string; subtitle?: string };
  display: ReplayDisplayOptions;
  fps: number;
  width: number;
  height: number;
  seed: number;
  durationFrames: number;
  shots: VideoShot[];
  media: MediaAsset[];
  audio: PlannedAudioCue[];
  subtitles?: PlannedSubtitleCue[];
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
  /** 当前完整几何与事实视图；world组件继承矩阵，混合席位锚点应放screen层并显式投影。 */
  view?: VideoFrameView;
}
export type VideoLayerRegistry = Record<string, ComponentType<CustomVideoLayerProps>>;
