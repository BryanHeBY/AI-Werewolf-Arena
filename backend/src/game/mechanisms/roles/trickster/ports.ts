/**
 * Exposes Trickster's concrete coupled cleanup and native roster query ports.
 * Inputs are original World/day reads and Magician's readonly transfer view;
 * outputs retain the cleanup unit, manager finish/abort port and roster assertion.
 * Stage timing stays at priority 100 and finished Day-exile mapping stays frame-owned.
 * These ports grant no exile/stock writer and never add outer-cycle cleanup,
 * render text, record data or duplicate the shared transfer owner.
 */
export { TricksterNightUnit, tricksterNightTerminal } from "./night-lifecycle";
export type { TricksterNightRuntime } from "./night-lifecycle";
export { assertTricksterRosterCurrent } from "./night_frame";
