/**
 * Provides the named legacy exit for Ghost Bride wedding, knife capture and tool consumers.
 * Inputs come from the public contract fact port; outputs retain original ID
 * constants, types and reader identities. This facade never computes outcomes,
 * owns resource stock, grants authority or renders user text. Remove it after
 * every recorded consumer has migrated to the public contract owner.
 */
export {
  GHOST_BRIDE_POLICY,
  GHOST_BRIDE_GOAL,
  GHOST_BRIDE_ROLE,
  freshGhostBrideState,
  readGhostBrideState,
  readWeddingPair,
  readWeddingGroup,
  readWeddingSetup,
  readWeddingKnifeCapture,
  readWeddingTool,
  GHOST_BRIDE_EVENT_TYPES,
  readGhostBrideEventFact,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
export type {
  WeddingStatus,
  GhostBrideState,
  WeddingVote,
  WeddingSetup,
  WeddingPair,
  WeddingGroup,
  WeddingKnifeOwner,
  WeddingKnifeCapture,
  WeddingTool,
} from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
