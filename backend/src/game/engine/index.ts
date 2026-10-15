/**
 * 为后端调用方统一导出阶段管理、请求工厂、窗口标识与流水线实现。
 * 这里只聚合各所有者的公开定义，不实例化对局、授予行动权限或决定结算顺序。
 */
export { EventRegistry } from "./event_registry";
export { PhaseManager } from "./phase_manager";
export { GameActionRequestFactory } from "./action_request_factory";
export { transferOrDestroySheriffBadge } from "../mechanisms/sheriff/badge";

export * from "./hooks/on_daybreak";
export * from "./hooks/on_per_speech_gap";
export * from "./hooks/on_pre_election";
export * from "./hooks/on_pre_vote";

export * from "./phase_pipeline/day_pipeline";
export * from "./phase_pipeline/night_pipeline";
export * from "./phase_pipeline/voting_pipeline";
