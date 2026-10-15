/**
 * 为后端调用方统一导出阶段管理、请求工厂、窗口标识与流水线实现。
 * 这里只聚合各所有者的公开定义，不实例化对局、授予行动权限或决定结算顺序。
 */
export { EventRegistry } from "./events/event-registry";
export { PhaseManager } from "./phase-manager";
export { GameActionRequestFactory } from "./actions/action-request-factory";
export { transferOrDestroySheriffBadge } from "../features/sheriff/badge-ports";

export * from "./hooks/on-daybreak";
export * from "./hooks/on-per-speech-gap";
export * from "./hooks/on-pre-election";
export * from "./hooks/on-pre-vote";

export * from "./phases/day-pipeline";
export * from "./phases/night-pipeline";
export * from "./phases/voting-pipeline";
