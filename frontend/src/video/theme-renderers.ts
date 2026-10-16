/**
 * 负责声明主题视觉插槽与宿主注册表。输入为已编译计划、当前帧和已裁剪玩家资料，输出 React 视觉组件的只读参数。
 * 插槽组件仅在项目模块中注册；JSON 只保存注册键，不保存函数、不恢复原归档或绕过展示策略。
 */
import type { ComponentType } from "react";
import type { ResolvedTheme, ThemePalette } from "../themes";
import type { VideoFrameView } from "./frame";
import type { VideoPlan } from "./types";

export interface VideoThemeSlotProps {
  plan: VideoPlan;
  view: VideoFrameView;
  theme: ResolvedTheme;
  palette: ThemePalette;
  playerId?: number;
  /** 已准备素材在本次宿主中的基准，预览和导出都通过同一解析器取资源。 */
  mediaBaseUrl?: string;
}
export type VideoThemeSlotRegistry = Readonly<Record<string, ComponentType<VideoThemeSlotProps>>>;
