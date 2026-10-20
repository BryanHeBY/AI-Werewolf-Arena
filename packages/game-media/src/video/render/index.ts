/**
 * 负责公开 React／Remotion 视频渲染 API。输入为已编译计划和组件注册表，输出按帧画面及音轨。
 * 本入口允许渲染依赖，不导出游戏写权；脚本编译与文件准备应直接使用相邻的 plan 入口。
 */
export * from "../VideoComposition";
export type { VideoThemeSlotProps, VideoThemeSlotRegistry } from "../theme-renderers";
