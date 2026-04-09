
/**
 * engine 层统一导出入口：聚合阶段管理、钩子与流水线实现。
 */
export { EventRegistry } from "./event_registry";
export { PhaseManager } from "./phase_manager";
export { transferOrDestroySheriffBadge } from "./sheriff_badge";

export * from "./hooks/on_daybreak";
export * from "./hooks/on_per_speech_gap";
export * from "./hooks/on_pre_election";
export * from "./hooks/on_pre_vote";

export * from "./phase_pipeline/day_pipeline";
export * from "./phase_pipeline/night_pipeline";
export * from "./phase_pipeline/voting_pipeline";
