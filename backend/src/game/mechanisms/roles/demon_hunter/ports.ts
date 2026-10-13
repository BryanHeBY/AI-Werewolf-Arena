/**
 * Exposes Demon Hunter's concrete night lifecycle boundary to the engine.
 * Opening runs during the original night stage; late handoff precedes pipeline cleanup.
 * Original request/currentness checks retain authority; this boundary authorizes no new scope.
 * Original read/write permissions stay with the concrete authority and resource owners.
 * Terminal close and abort keep the original manager and pipeline order.
 * Inputs and outputs keep the original World, opening and terminal references;
 * the actual unit owns acquisition/transfer, while sealed authority owns rules.
 * Named exports add no wrapper state, inventory, runtime permit or codec policy.
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
} from "./authority";
