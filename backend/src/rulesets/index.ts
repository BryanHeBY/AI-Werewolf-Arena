/**
 * Public ruleset setup boundary consumed by configuration and game assembly.
 * Exports finite inert support predicates, their ordered rejection dispatcher
 * and the distinct Node Demon Hunter ingress. These verdicts never execute a
 * game or grant action authority. Archive verification owns separate checks.
 */
export * from "./support";
export { boardPresetViolation } from "./board-support";
export { isDemonHunterPreset as isDemonHunterNodePreset } from "./node-board-support";
