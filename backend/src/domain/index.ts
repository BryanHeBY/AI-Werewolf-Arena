/**
 * domain 层统一导出入口。
 */
export * from "./model";
export { World } from "./world";

export * from "./components/alive";
export * from "./components/badge";
export * from "./components/camp";
export * from "./components/names";
export * from "./components/role";
export * from "./components/status_marks";
export * from "./components/voting_right";

export * from "./entities/player";
export * from "./registries/condition_registry";
export * from "./registries/phase_registry";
export * from "./registries/role_registry";
export * from "./systems/damage_resolution_system";
export * from "./systems/win_condition_system";
