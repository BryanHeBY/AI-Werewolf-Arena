/**
 * Provides the named legacy exit for Thief initial deal and chosen identity consumers.
 * Inputs come from the public contract fact port; outputs retain original ID
 * constants, types and reader identities. This facade never computes outcomes,
 * owns resource stock, grants authority or renders user text. Remove it after
 * every recorded consumer has migrated to the public contract owner.
 */
export {
  THIEF_EVENT_TYPES,
  readThiefEventFact,
} from "@ai-werewolf-arena/game-contract/facts/thief";
