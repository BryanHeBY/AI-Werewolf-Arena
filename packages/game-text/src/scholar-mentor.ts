/**
 * Provides the named legacy fact exit for existing text and application clients.
 * Inputs come from game-contract's Scholar/Mentor fact owner; outputs are the
 * exact original types and reader functions. This compatibility facade creates
 * no state, translates no facts and grants no action permission. Consumers move
 * to the public contract subpath before this temporary exit can be removed.
 */
export {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierConflictFact,
  readModifierBonusFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
export type {
  ModifierFactMode,
  ModifierFactKind,
  ModifierChoiceFact,
  ModifierSkipFact,
  ModifierConflictFact,
  ModifierBonusFact,
} from "@ai-werewolf-arena/game-contract/facts/scholar-mentor";
