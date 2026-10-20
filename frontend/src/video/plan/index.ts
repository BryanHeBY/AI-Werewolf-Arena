/**
 * 负责公开纯数据视频编排 API。输入为归档、脚本与显式帧，输出可序列化计划和帧视图。
 * 准备、检查及非 React 消费者使用本入口；运行时依赖不得到达 React、Remotion 或画面装配。
 */
export * from "../types";
export * from "../source";
export { isVideoSpeaker } from "../speakers";
export { compileVideoPlan, defineVideoScript, type VideoCustomProps } from "../compiler";
export * from "../captions";
export * from "../subtitles";
export * from "../layout";
export * from "../frame";
export { auditVideoReplay } from "./audit";
export { classifyVideoScene } from "../scene-classification";
