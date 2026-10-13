/**
 * Exposes Time Consort's concrete pipeline-transfer and manager-terminal ports.
 * Inputs are delegated original World reads and manager World/day arguments;
 * outputs are the cleanup unit, terminal port, structural runtime type and
 * original readable-board/roster assertions. Query errors propagate unchanged.
 * The unit only suppresses pipeline abort after the original late transfer.
 * Priority-50 stage opening stays separate; close and repeated abort keep their
 * original timing and frame errors; the paid reflected-effect command is a separate explicit capability.
 * This public exit never renders text or creates another lifecycle owner.
 * Native target reads also expose original reflected scopes; the separate paid-effect command alone consumes their existing commit receipt at its old position.
 */
export { TimeConsortNightUnit, timeConsortNightTerminal } from "./night-lifecycle";
export type { TimeConsortNightRuntime } from "./night-lifecycle";
export { isTimeConsortBoard, assertTimeConsortRosterCurrent } from "./night_frame";
export { resolveTimeConsortTarget } from "./night_frame";
export type { TimeConsortReceipt } from "./night_frame";
export { commitTimeConsortEffect } from "./effects";
