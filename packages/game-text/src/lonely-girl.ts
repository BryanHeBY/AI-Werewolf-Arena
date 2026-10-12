/**
 * Provides the named legacy exit for Lonely Girl choice, optional camp and tool consumers.
 * Inputs come from the public contract fact port; outputs retain original ID
 * constants, types and reader identities. This facade never computes outcomes,
 * owns resource stock, grants authority or renders user text. Remove it after
 * every recorded consumer has migrated to the public contract owner.
 */
export {
  LONELY_GIRL_POLICY,
  LONELY_GIRL_EVENT_TYPES,
  readLonelyGirlEventFact,
  readLonelyGirlChoiceTool,
} from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
export type { LonelyGirlChoiceFact } from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
