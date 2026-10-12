/**
 * Provides the named compatibility exit for existing Nightmare fear clients.
 * Inputs come from the public game-contract fact owner; outputs retain original
 * types, readers and ID constants. This facade never writes state, pays stock,
 * settles effects or renders messages; remove it only after consumers migrate.
 */
export {
  NIGHTMARE_EVENT_TYPE,
  readNightmareFearFact,
  readNightmareOwnFearFact,
} from "@ai-werewolf-arena/game-contract/facts/nightmare";
export type {
  NightmareFearFact,
  NightmareOwnFearFact,
} from "@ai-werewolf-arena/game-contract/facts/nightmare";
