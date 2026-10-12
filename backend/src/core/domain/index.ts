/**
 * Public domain boundary for engine, feature and application consumers.
 * Exports existing World storage, component factories, runtime permission ports
 * and domain declarations. The typed component map relates names to original
 * stored objects; exports never serialize handles or replace their owners.
 */
export * from "./model";
export * from "./action_request_context";
export * from "./random";
export { World } from "./world";
export type { ComponentMap, ComponentWrite } from "./component-map";

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

export * from "./components/victory";
export * from "./components/lovers";
export * from "./components/debate_penalty";
export * from "./components/wall_note";

export * from "./request_delivery";
