/**
 * 为前端工作台、视频项目脚本和离线 CLI 消费者导出统一编排与渲染 API。
 * 公开类型、编译器和纯帧组件；不导出对局写权，不在模块装载时读档或执行渲染。
 */
export * from "./types";
export * from "./source";
export * from "./compiler";
export * from "./captions";
export * from "./layout";
export * from "./frame";
export * from "./VideoComposition";
