import {
  Phase,
  type World,
  type GameEvent,
  type ActionProvider,
  type ActionStage,
  type ToolName,
  type ToolCall,
} from "../../../../core";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import { DEMON_HUNTER_POLICY, readDemonHuntTool } from "./state";
import {
  demonHunterActorId,
  openDemonHunterTurn,
  closeDemonHunterTurn,
  bindDemonHunterRequest,
  authorizedDemonHunter,
  canSubmitDemonHunt,
  commitDemonHunt,
} from "./authority";
export interface DemonHunterChoiceFact {
  readonly policy: typeof DEMON_HUNTER_POLICY;
  readonly actorId: number;
  readonly day: number;
  readonly targetId: number | null;
}
/** Candidate native controller. Default catalog registration waits for the complete runtime/replay chain. */
export async function executeDemonHunterTurn(input: {
  world: World;
  gateway: ToolGateway;
  events: GameEvent[];
  provider: ActionProvider;
  day: number;
}): Promise<Readonly<DemonHunterChoiceFact>> {
  const { world, gateway, events, provider, day } = input,
    actorId = demonHunterActorId(world);
  if (actorId === null) throw new Error("demon_hunter_actor_unavailable");
  const scope = openDemonHunterTurn(world);
  try {
    const request = new GameActionRequestFactory(world, events, day).create({
      phase: Phase.Night,
      actorId,
      allowedTools: ["demon_hunt" as ToolName],
      stage: "demon_hunter" as ActionStage,
      requiresAction: true,
      summary: { key: "request.summary.night_action" },
      context: { allow_fallback: false, action_failure_policy: "error" },
    });
    bindDemonHunterRequest(world, request);
    if (!authorizedDemonHunter(world, actorId, Phase.Night, day, scope))
      throw new Error("demon_hunter_turn_revoked");
    const raw = await provider.getAction(request);
    if (!authorizedDemonHunter(world, actorId, Phase.Night, day, scope))
      throw new Error("demon_hunter_turn_revoked");
    const call = readDemonHuntTool(raw);
    if (!call || !canSubmitDemonHunt(world, actorId, Phase.Night, day, scope, call))
      throw new Error("demon_hunter_required_action_invalid");
    const valid = gateway.validateAndSanitize(world, actorId, call as unknown as ToolCall, {
      phase: Phase.Night,
      day,
      demonHunterScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall) throw new Error("demon_hunter_action_invalid");
    const choice = commitDemonHunt(world, scope, call);
    if (!choice) throw new Error("demon_hunter_action_commit_failed");
    safeRecordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId,
      phase: Phase.Night,
      status: "ok",
      input: { tool: call.name, args: call.args },
    });
    return Object.freeze({
      policy: DEMON_HUNTER_POLICY,
      actorId,
      day: choice.day,
      targetId: choice.targetId,
    });
  } finally {
    closeDemonHunterTurn(scope);
  }
}
