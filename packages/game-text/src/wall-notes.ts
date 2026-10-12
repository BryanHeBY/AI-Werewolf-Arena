/**
 * Provides the named legacy exit for Wall Note text, event, item snapshot and tool consumers.
 * Inputs come from the public contract fact port; outputs retain original ID
 * constants, types and reader identities. This facade never computes outcomes,
 * owns resource stock, grants authority or renders user text. Remove it after
 * every recorded consumer has migrated to the public contract owner.
 */
export {
  WALL_EVENT_TYPES,
  validWallText,
  readWallTool,
  readWallEventFact,
  readWallNoteData,
} from "@ai-werewolf-arena/game-contract/facts/wall-notes";
