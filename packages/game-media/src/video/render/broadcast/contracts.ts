/**
 * 负责广播场景间的只读渲染输入契约。输入为宿主已求值的字幕、尺寸与主题，输出各版式共享的窄类型。
 * 不传递投影器、运行时状态或隐式 Context；玩家事实和主题插槽由各组件显式接收。
 */
import type { ReactNode } from "react";
import type { ResolvedTheme, ThemePalette, ThemeSlot, themeSurface } from "../../../themes";
import type { VideoFrameView } from "../../frame";
import type { VideoPlan, VideoScene } from "../../types";
import type { SpeechReadingCue } from "./speech-reading";

export type BroadcastSceneLayout =
  "speech" | "ballot" | "action" | "end" | "phase" | "settlement" | "notice";
export interface SceneCaption {
  readonly text: string;
  readonly offset: number;
  readonly pageIndex: number;
  readonly pages: readonly string[];
  readonly scheduled: boolean;
  /** 新广播全文阅读的纯帧进度；旧计划缺省时保持原字幕页与偏移。 */
  readonly reading?: {
    readonly progress: number;
    readonly scrollProgress: number;
    readonly active: boolean;
    /** 缺省为旧计划连续滚动；有策略时scrollFrames为扣除首尾停留后的纯帧区间。 */
    readonly motion?: "line" | "continuous" | "static";
    readonly transitionFrames?: number;
    readonly scrollFrames?: number;
  };
  /** 只来自已裁剪展示资料，保护换行而不推断原话意图或身份。 */
  readonly protectedTerms?: readonly string[];
  /** 镜头局部帧与真实文字锚点独立于字幕的延后显示；不匹配的说明页不强行跟读。 */
  readonly speechReading?: { cues: readonly SpeechReadingCue[]; frame: number };
}
export interface SceneMetrics {
  readonly scale: number;
  readonly stage: VideoFrameView["layout"]["stage"];
  readonly readingWidth: number;
  readonly bodySize: number;
  readonly lineHeight: number;
  readonly padding: number;
  readonly subtitleSafeArea?: boolean;
}
export interface SceneAppearance {
  readonly theme: ResolvedTheme;
  readonly palette: ThemePalette;
  readonly cards: ThemePalette;
  readonly surface: ReturnType<typeof themeSurface>;
  readonly gothic: boolean;
  readonly night: boolean;
  readonly visibleRoles?: Readonly<Record<number, string>>;
}
/** 中央场景只接本段渲染资料，不持有整局计划或能够改变游标的回调。 */
export interface SceneRenderProps {
  readonly scene: VideoScene;
  readonly caption: SceneCaption;
  readonly localFrame: number;
  readonly metrics: SceneMetrics;
  readonly appearance: SceneAppearance;
  readonly locale: VideoPlan["display"]["locale"];
}
/** 复用既有主题槽注册表的调用口，不引入第二份注册或主题选择。 */
export type RenderThemeSlot = (key: ThemeSlot, fallback: ReactNode, playerId?: number) => ReactNode;
