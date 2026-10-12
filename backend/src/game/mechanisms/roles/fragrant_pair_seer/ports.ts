/**
 * Exposes the concrete Fragrant night unit to the engine's night orchestration.
 * Inputs are original runtime ports at the opening/closing boundaries; outputs
 * retain authority facts and terminal acquisition state in their existing order.
 * The engine reads board/snapshot metadata and invokes open, normal close and
 * conditional abort; the unit does
 * not advance phases, commit deaths or refund paid effects after failure.
 */
export { FragrantNightUnit } from "./night-lifecycle";
export type { FragrantNightRuntime } from "./night-lifecycle";
export { isFragrantPairBoard, fragrantAuthoritySnapshot } from "./authority";
export { FRAGRANT_PAIR_POLICY } from "./state";
