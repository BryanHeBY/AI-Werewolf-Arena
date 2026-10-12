/**
 * Provides the named fact-reader compatibility exit for existing text consumers.
 * Inputs and outputs come unchanged from game-contract's Time Wolf Consort lock, skip and reflection data
 * owner. This facade never renders text, evaluates board support or grants
 * domain authority; consumers migrate before the C44 exit-removal boundary.
 */
export {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
  readTimeConsortReflectionFact,
} from "@ai-werewolf-arena/game-contract/facts/time-consort";
export type {
  TimeConsortChoiceFact,
  TimeConsortSkipFact,
  TimeConsortReflectionFact,
} from "@ai-werewolf-arena/game-contract/facts/time-consort";
