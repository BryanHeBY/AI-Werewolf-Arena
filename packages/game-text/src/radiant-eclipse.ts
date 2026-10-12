/**
 * Provides the named compatibility exit for existing radiant-eclipse fact consumers.
 * Inputs are public contract reader/type ports; outputs retain the original
 * exports without duplicate parsing. This facade never renders text, validates
 * finite board support or grants domain authority; Node ingress stays separate.
 */
export {
  RADIANT_ECLIPSE_EVENT_TYPES,
  readRadiantEclipseFact,
  radiantEclipseAudience,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
export type { RadiantEclipseFact } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
