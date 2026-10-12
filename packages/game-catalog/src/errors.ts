/**
 * Provides the named compatibility exit for catalog rule-error consumers.
 * Inputs come from game-contract's sole data owner; outputs preserve existing
 * public imports and types. This bridge performs no rule calculation, rendering
 * or additional state write and must disappear after its consumers migrate.
 */
export { RuleError } from "@ai-werewolf-arena/game-contract";
export type { RuleViolation } from "@ai-werewolf-arena/game-contract";
