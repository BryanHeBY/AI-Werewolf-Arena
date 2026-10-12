/**
 * Compatibility exit for backend and replay consumers of Trickster facts.
 * Exports contract-owned pure payload types and readers by their existing names.
 * Inputs come from the public contract fact port; outputs keep existing exports.
 * Parsing remains inert-data only; role state, target mapping and settlement stay
 * outside this facade. Remove after consumers use the public contract fact port.
 */
export {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
} from "@ai-werewolf-arena/game-contract/facts/trickster";
export type {
  TricksterExchangeFact,
  TricksterSkipFact,
  ExileMappingFact,
} from "@ai-werewolf-arena/game-contract/facts/trickster";
