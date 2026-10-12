/**
 * Responsibility: preserve the shared inert copier exit for existing text facts.
 * Input/output: unchanged game-contract copyEventData data and rejection codes.
 * This compatibility facade owns no parser, permissions or state; feature fact
 * readers migrate to contract leaves before this exit is removed in C44.
 */
export { copyEventData } from "@ai-werewolf-arena/game-contract";
