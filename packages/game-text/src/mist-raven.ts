/**
 * Provides the named compatibility exit for existing mist-raven fact consumers.
 * Inputs are public contract reader/type ports; outputs retain the original
 * exports without duplicate parsing. This facade never renders text, validates
 * finite board support or grants domain authority; Node ingress stays separate.
 */
export {
  MIST_RAVEN_EVENT_TYPES,
  readMistRavenFact,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
export type {
  MistRavenEventType,
  MistRavenFact,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
