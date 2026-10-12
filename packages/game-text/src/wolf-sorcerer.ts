/**
 * Provides the named fact-reader compatibility exit for existing text consumers.
 * Inputs and outputs come unchanged from game-contract's Wolf Sorcerer exchange and skip data
 * owner. This facade never renders text, evaluates board support or grants
 * domain authority; consumers migrate before the C44 exit-removal boundary.
 */
export {
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
export type {
  WolfSorcererExchangeFact,
  WolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-contract/facts/wolf-sorcerer";
