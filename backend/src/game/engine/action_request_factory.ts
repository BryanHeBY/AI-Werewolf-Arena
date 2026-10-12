/**
 * Responsibility: assemble engine action requests from the original World and explicit stage.
 * Input: actor/window, projected visible facts, allowed tools and neutral summaries;
 * output: native requests with existing role-owned scope and delivery bindings.
 * Domain mechanisms own authorization and resource commit. This factory neither
 * renders localized text nor serializes runtime scopes; copied DTOs are not leases.
 */
import { bindGhostBrideRequest } from "../mechanisms/roles/ghost_bride/authority";
import { bindLonelyGirlRequest } from "../mechanisms/roles/lonely_girl/lifecycle";
import { bindWildChildRequest } from "../mechanisms/roles/wild_child/lifecycle";
import { bindInitialIdentityRequest } from "../mechanisms/roles/initial_identity/setup";
import { bindWallRequest } from "../mechanisms/events/wall_notes/authority";
import type { MessageRef } from "@ai-werewolf-arena/game-contract";
import {
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  ActionWindow,
  EntityId,
  GameEvent,
  Phase,
  ToolName,
} from "../../core/domain/model";
import { World } from "../../core/domain/world";
import { buildAgentVisibleEventFeed } from "./agent_visible_event_feed";
import { buildTurnConstraintContext } from "./turn_constraints_context";

/**
 * 统一创建游戏对 Agent 的行动请求。
 *
 * 该工厂是引擎写入 ActionRequest.context 的唯一入口：它固定日次、细粒度 stage、
 * 玩家可见事件与结构化行动约束，避免各机制手写并逐渐产生不同语义。
 */
export class GameActionRequestFactory {
  constructor(
    private readonly world: World,
    private readonly events: readonly GameEvent[],
    private readonly day: number,
  ) {}

  create(input: {
    phase: Phase;
    actorId: EntityId;
    allowedTools: ToolName[];
    stage: ActionStage;
    requiresAction: boolean;
    summary: string | MessageRef;
    actionWindow?: ActionWindow;
    context?: ActionRequestExtras;
  }): ActionRequest {
    // 公共事实由工厂生成；调用方只能提供机制特有的信息。
    const request: ActionRequest = {
      phase: input.phase,
      actorId: input.actorId,
      allowedTools: [...input.allowedTools],
      ...(input.actionWindow ? { actionWindow: input.actionWindow } : {}),
      context: {
        ...structuredClone(input.context ?? {}),
        day: this.day,
        stage: input.stage,
        turn_constraints: buildTurnConstraintContext({
          requiresAction: input.requiresAction,
          allowedTools: input.allowedTools,
          summary: input.summary,
        }),
        visible_events: buildAgentVisibleEventFeed(this.world, [...this.events], input.actorId),
      },
    };
    if (input.stage === "lonely_girl") bindLonelyGirlRequest(this.world, request);
    if (input.stage === "wild_child") bindWildChildRequest(this.world, request);
    if (input.stage === "thief" || input.stage === "shapeshifter")
      bindInitialIdentityRequest(this.world, request);
    if (input.stage === "wall_notes") bindWallRequest(this.world, request);
    if (
      [
        "ghost_bride_groom",
        "ghost_bride_chat",
        "ghost_bride_witness",
        "ghost_bride_knife",
        "wolf_vote",
      ].includes(input.stage)
    )
      bindGhostBrideRequest(this.world, request);
    return request;
  }
}
