/**
 * Exposes Animal Dream's night unit and read-only authority snapshot to the engine.
 * Inputs are the original runtime at actual night boundaries; outputs retain the
 * same state/facts and closure order. Engine orchestration reads the snapshot and
 * invokes open/normal-close/abort; this port never settles Cat/Puffer deaths or
 * refunds a paid Fox choice after failure.
 */
export { AnimalNightUnit } from "./night-lifecycle";
export type { AnimalNightRuntime } from "./night-lifecycle";
export { animalAuthoritySnapshot } from "./authority";
