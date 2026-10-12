/**
 * Provides the named compatibility exit for existing Red Moon delay clients.
 * Inputs come from the public game-contract fact owner; outputs retain original
 * types, readers and ID constants. This facade never writes state, pays stock,
 * settles effects or renders messages; remove it only after consumers migrate.
 */
export {
  RED_MOON_BLAST_EVENT,
  RED_MOON_EXILE_EVENT,
  RED_MOON_EXPIRY_EVENT,
  readRedMoonNextNightFact,
  readRedMoonExpiryFact,
} from "@ai-werewolf-arena/game-contract/facts/red-moon";
export type {
  RedMoonNextNightFact,
  RedMoonExpiryFact,
} from "@ai-werewolf-arena/game-contract/facts/red-moon";
