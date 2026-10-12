/**
 * Provides the named compatibility exit for existing fragrant-pair-seer fact consumers.
 * Inputs are public contract reader/type ports; outputs retain the original
 * exports without duplicate parsing. This facade never renders text, validates
 * finite board support or grants domain authority; Node ingress stays separate.
 */
export {
  FRAGRANT_PAIR_POLICY,
  readFragrantKnownState,
  readPairCheckFact,
  FRAGRANT_PAIR_EVENT_TYPES,
  fragrantPairVisibility,
  readFragrantPairFact,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
export type {
  FragrantPair,
  PairCheckFact,
  FragrantKnowledge,
  FragrantPlayerState,
  FragrantPairPayloadMap,
  FragrantPairEventType,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
