/**
 * Responsibility: define domain action/request data and the existing action-provider port.
 * Input: machine identities, player-visible facts and neutral message references;
 * output: typed tools, arguments, request contexts and validation results.
 * Declarations grant no runtime authority or resources; engine-owned leases and
 * current-state checks remain separate. ActionProvider is an execution interface,
 * not serialized data. Existing optional extras and strict turn fields are preserved.
 */
import type { ToolCall } from "@ai-werewolf-arena/game-contract";
export { TOOL_NAMES, ACTION_STAGES, DEATH_SHOT_STAGES } from "@ai-werewolf-arena/game-contract";
export type {
  ToolArgMap,
  ToolName,
  ToolCall,
  TypedToolCall,
  ToolValidationResult,
  TurnConstraints,
  ActionStage,
} from "@ai-werewolf-arena/game-contract";

import type { EntityId } from "./identity";

export interface KnightDuelSelection {
  actorId: EntityId;
  targetId: EntityId;
}
export type KnightDuelCommit = "rejected" | "continue" | "night" | "terminal";
export type SelfDestructSelection =
  | { kind: "ordinary"; actorId: EntityId; targetId: null }
  | { kind: "white_wolf_king"; actorId: EntityId; targetId: EntityId | null };

import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
export type {
  ActionRequest,
  ActionRequestContext,
  ActionRequestExtras,
} from "@ai-werewolf-arena/game-contract/requests";

export interface ActionProvider {
  getAction(request: ActionRequest): Promise<ToolCall | null>;
}
