/**
 * Provides the named compatibility exit for existing Demon Hunter event, player-history and tool clients.
 * Inputs come from the public game-contract fact owner; outputs retain original
 * types, readers and ID constants. This facade never writes state, pays stock,
 * settles effects or renders messages; remove it only after consumers migrate.
 */
export {
  DEMON_HUNTER_POLICY,
  DEMON_HUNTER_EVENT_TYPES,
  readDemonHunterEventFact,
  readDemonHunterPlayerFact,
  readDemonHunterState,
  readDemonHuntTool,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
export type {
  DemonHunterChoiceFact,
  DemonHunterPlayerFact,
  DemonHunterCancelFact,
  DemonHunterPoisonImmuneFact,
  DemonHunterEventFact,
  DemonHunterState,
  DemonHuntTool,
} from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
