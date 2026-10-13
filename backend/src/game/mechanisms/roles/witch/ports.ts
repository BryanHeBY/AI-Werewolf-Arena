/**
 * Exposes Witch ordinary payload commands at their existing commit boundaries.
 * Inputs are selected read-only state/ability references after original rule checks; outputs
 * preserve reset, stock and flag writes in order. Callers retain permission and
 * effect ownership; failure never rolls back marks or prior consumed resources.
 * Independent audit ledgers and sealed native Demon stock do not call this port.
 */
export {
  getWitchState,
  resetWitchNightState,
  refreshWitchSelfHeal,
  closeWitchPotionTurn,
  consumeWitchHeal,
  consumeWitchPoison,
  consumeRecipientPoison,
} from "./state";
export type { WitchState, WitchReadState } from "./state";
