/**
 * Exposes Radiant's concrete night unit and original frame queries to the pipeline.
 * Inputs are original World/events at opening and terminal boundaries; outputs
 * retain roster checks, sealed effects and authoritative repeated-close behavior.
 * Runtime ports grant only their existing frame operations, never phase, actor
 * selection or death commit rights. Acquired abort still reads arguments after
 * normal close; its native frame owns terminal idempotence and failure prefixes.
 * Player projection reads the original Eclipse slot through its existing detached
 * reader; it grants no live slot, World or resource write rights.
 */
export { RadiantNightUnit } from "./night-lifecycle";
export type { RadiantNightRuntime } from "./night-lifecycle";
export {
  isRadiantEclipseBoard,
  assertRadiantRosterCurrent,
  sealRadiantNightEffects,
} from "./night_frame";

export { projectEclipseState } from "./state";
