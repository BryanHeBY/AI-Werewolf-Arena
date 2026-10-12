/**
 * Provides the named legacy exit for Debate speech, ballot and resolved count consumers.
 * Inputs come from the public contract fact port; outputs retain original ID
 * constants, types and reader identities. This facade never computes outcomes,
 * owns resource stock, grants authority or renders user text. Remove it after
 * every recorded consumer has migrated to the public contract owner.
 */
export {
  DEBATE_EVENT_TYPES,
  readDebateEventFact,
} from "@ai-werewolf-arena/game-contract/facts/debate";
