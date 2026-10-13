/**
 * Exposes Magician's concrete shared cleanup owner and native readability ports.
 * Inputs are the original configured transfer value or World/day terminal reads;
 * outputs are the unit, readonly boolean ownership view and original query bindings.
 * The shared view grants no transfer command, World, target mapping or stock writer.
 * Stage timing and frame rejection remain unchanged; this public exit never renders
 * text, records data or creates another lifecycle owner.
 * The native mapped-target query returns the original current-life binding; its data does not grant a stock or exchange commit method.
 */
export { MagicianNightUnit, magicianNightTerminal } from "./night-lifecycle";
export type { MagicianNightRuntime, MagicianNightCleanupOwnership } from "./night-lifecycle";
export { assertMagicianRosterCurrent, isMagicianBoard } from "./night_frame";
export { resolveMagicianNightTarget } from "./night_frame";
export type { MagicianResolvedTarget } from "./night_frame";
