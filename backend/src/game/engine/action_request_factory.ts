import {
  ActionRequest,
  ActionRequestContext,
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
    stage: string;
    requiresAction: boolean;
    summary: string;
    actionWindow?: ActionWindow;
    context?: ActionRequestContext;
  }): ActionRequest {
    // 日次、阶段层级、可见事件与行动约束由引擎拥有；调用方不能借由 extra
    // context 写入旧字段或伪造这些公共事实。
    const {
      day: _ignoredDay,
      stage: _ignoredStage,
      visible_events: _ignoredVisibleEvents,
      turn_constraints: _ignoredConstraints,
      current_day: _ignoredLegacyDay,
      phase: _ignoredLegacyStage,
      window: _ignoredLegacyWindow,
      ...extraContext
    } = input.context ?? {};
    return {
      phase: input.phase,
      actorId: input.actorId,
      allowedTools: [...input.allowedTools],
      ...(input.actionWindow ? { actionWindow: input.actionWindow } : {}),
      context: {
        ...extraContext,
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
  }
}
