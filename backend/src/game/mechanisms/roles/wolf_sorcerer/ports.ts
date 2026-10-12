/**
 * Exposes Wolf Sorcerer's concrete coupled cleanup and native roster query ports.
 * Inputs are original World/day reads and Magician's readonly transfer view;
 * outputs retain the cleanup unit, manager terminal port and roster assertion.
 * Opening stays stage-owned at priority 100; the ports grant no target/stock writer.
 * Native frame errors propagate at original timing, without rendering, recording
 * or creating a second owner for the shared transfer value.
 */
export { WolfSorcererNightUnit, wolfSorcererNightTerminal } from "./night-lifecycle";
export type { WolfSorcererNightRuntime } from "./night-lifecycle";
export { assertWolfSorcererRosterCurrent } from "./night_frame";
