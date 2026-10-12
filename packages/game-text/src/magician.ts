/**
 * Compatibility exit for backend and replay consumers of Magician facts.
 * Exports contract-owned pure payload types and readers by their existing names.
 * Inputs come from the public contract fact port; outputs keep existing exports.
 * Parsing remains inert-data only; role state, target mapping and settlement stay
 * outside this facade. Remove after consumers use the public contract fact port.
 */
export {
  MAGICIAN_EVENT_TYPE,
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";
export type {
  MagicianExchangeFact,
  MagicianOwnExchangeFact,
  DeathShotMissFact,
} from "@ai-werewolf-arena/game-contract/facts/magician";
