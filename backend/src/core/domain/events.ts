/**
 * Named compatibility exit for the engine's serialized event data consumers.
 * Input: public protocol declarations from the contract package.
 * Outputs the contract-owned event map and original required audience types.
 * This facade never validates live permissions, stores events or runs effects;
 * publication, projection and Node hostile-object ingress remain separate owners.
 */
export { WOLF_TEAM_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/events";
export type {
  EventBase,
  VoteRecord,
  SheriffVoteRecord,
  PrivatePlayerInfo,
  ExileFeedback,
  EventPayloadMap,
  WolfTeamEventType,
  WeddingEventType,
  GameEvent,
  PlayerVisibleEvent,
} from "@ai-werewolf-arena/game-contract/events";
