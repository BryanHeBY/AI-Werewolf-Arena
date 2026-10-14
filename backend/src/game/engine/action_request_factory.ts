/**
 * 负责从原 World 与明确阶段构造引擎行动请求。输入为演员、窗口、允许工具和中立摘要；
 * 输出固定日次、阶段、约束及玩家可见事实，完整构造之后交规则集按原顺序接线机制绑定。
 * 具体机制仍唯一持有权限、期限别名与资源提交；请求数据副本不是行动许可。
 * 本工厂不渲染本地化文案、不序列化运行范围，也不据阶段字符串新增角色权限。
 */
import { bindRulesetActionRequest } from "../../rulesets/action-request-bindings";
import type { ActionRequestConstructionInput, ActionRequestConstructionPort } from "../../core/domain/actions";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import { World } from "../../core/domain/world";
import { buildAgentVisibleEventFeed } from "./agent_visible_event_feed";
import { buildTurnConstraintContext } from "./turn_constraints_context";

/**
 * 统一创建游戏对 Agent 的行动请求。
 *
 * 该工厂统一填入原生请求的日次、细粒度 stage、玩家可见事件与结构化行动约束；
 * 调用方提供机制附加数据，运行时权限仍由具体机制保存，不混入这些公共字段。
 */
export class GameActionRequestFactory implements ActionRequestConstructionPort {
  constructor(
    private readonly world: World,
    private readonly events: readonly GameEvent[],
    private readonly day: number,
  ) {}

  create(input: ActionRequestConstructionInput): ActionRequest {
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
    // 原输入的阶段仍逐分支读取，不用已构造的 context.stage 替代后续 getter；World 也只在命中时读。
    bindRulesetActionRequest(request, {
      stage: () => input.stage,
      world: () => this.world,
    });
    return request;
  }
}
