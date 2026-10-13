/**
 * Exposes Demon Hunter's concrete night lifecycle boundary to the engine.
 * Opening runs during the original night stage; late handoff precedes pipeline cleanup.
 * Original request/currentness checks retain authority; this boundary authorizes no new scope.
 * Original read/write permissions stay with the concrete authority and resource owners.
 * Terminal close and abort keep the original manager and pipeline order.
 * Inputs and outputs keep the original World, opening and terminal references;
 * the actual unit owns acquisition/transfer, while sealed authority owns rules.
 * Named exports add no wrapper state, inventory, runtime permit or codec policy.
 * Native controller loaders return the original dynamic import Promise only when used; exporting them does not eagerly initialize either controller.
 */
export { DemonNightUnit, demonNightTerminal } from "./night-lifecycle";

/** Original engine queries retain their exact authority binding and arguments. */
export {
  isRedMoonBoard,
  demonHunterActorId,
  assertDemonNightReadable,
  originalDemonNightLives,
  demonOriginalWolfSourceCurrent,
  demonOriginalWolfTargetCurrent,
  demonRedMoonExpiry,
  commitDemonRedMoonTransition,
  committedDemonFaultBoundary,
  assertDemonOriginalRoster,
  hasDemonNightStarted,
  demonWitchRequiredThisNight,
} from "./authority";

/** Native controllers keep the original lazy import Promise and initialize only on use. */
export function loadDemonNativeNightController() {
  return import("./native_night_controller");
}

export function loadDemonNativePotionController() {
  return import("./native_potion_controller");
}
