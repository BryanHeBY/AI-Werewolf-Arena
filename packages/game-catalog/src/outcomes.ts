/**
 * Provides the named compatibility exit for catalog victory consumers.
 * Inputs come from game-contract's sole data owner; outputs preserve existing
 * public imports and types. This bridge performs no rule calculation, rendering
 * or additional state write and must disappear after its consumers migrate.
 */
export { FACTION_IDS, VICTORY_CHECKPOINTS } from "@ai-werewolf-arena/game-contract";
export type {
  FactionId,
  VictoryCheckpoint,
  VictoryPoint,
  VictoryAffiliation,
  VictoryTarget,
  VictoryClaim,
  GameOutcome,
  SealedVictoryResult,
} from "@ai-werewolf-arena/game-contract";
