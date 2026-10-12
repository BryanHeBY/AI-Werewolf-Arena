/**
 * Provides the named legacy exit for Shapeshifter initial deal, identity and choice tool consumers.
 * Inputs come from the public contract fact port; outputs retain original ID
 * constants, types and reader identities. This facade never computes outcomes,
 * owns resource stock, grants authority or renders user text. Remove it after
 * every recorded consumer has migrated to the public contract owner.
 */
export {
  SHAPESHIFTER_EVENT_TYPES,
  readShapeshifterEventFact,
  readShapeshifterChoiceTool,
} from "@ai-werewolf-arena/game-contract/facts/shapeshifter";
