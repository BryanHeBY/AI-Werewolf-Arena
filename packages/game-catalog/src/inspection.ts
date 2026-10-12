/**
 * Provides the named compatibility exit for catalog inspection consumers.
 * Inputs come from game-contract's sole data owner; outputs preserve existing
 * public imports and types. This bridge performs no rule calculation, rendering
 * or additional state write and must disappear after its consumers migrate.
 */
export type {
  InspectionCamp,
  InspectionResult,
  InspectionKind,
} from "@ai-werewolf-arena/game-contract";
