/**
 * Exposes Ghost Bride's concrete night lifecycle boundary to the engine.
 * Opening runs during the original night stage; late handoff precedes pipeline cleanup.
 * Original request/currentness checks retain authority; this boundary authorizes no new scope.
 * Original read/write permissions stay with the concrete authority and resource owners.
 * Terminal close and abort keep the original manager and pipeline order.
 * Inputs and outputs retain original capture/closing references and owned events;
 * the unit alone holds cleanup transfer. Setup and paid relationship authority
 * remain their original owners. Named exports grant no new turn or stock rights.
 */
export { WeddingNightUnit, weddingNightTerminal } from "./night-lifecycle";

/** Original engine queries retain their exact authority binding and arguments. */
export {
  weddingSetup,
  ghostBrideReady,
  hasActiveGhostBride,
  hasGhostBrideNightCommit,
  weddingAssignment,
  weddingKnifeCurrent,
} from "./authority";
