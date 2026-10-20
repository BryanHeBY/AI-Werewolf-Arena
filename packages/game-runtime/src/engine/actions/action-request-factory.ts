/**
 * 负责从原 World 与明确阶段构造引擎行动请求。输入为演员、窗口、允许工具和中立摘要；
 * 输出固定日次、阶段、约束及玩家可见事实，完整构造之后交规则集按原顺序接线机制绑定。
 * 具体机制仍唯一持有权限、期限别名与资源提交；本工厂不计算或写 deadlineAtMs，请求数据副本不是行动许可。
 * 本工厂不渲染本地化文案、不序列化运行范围，也不据阶段字符串新增角色权限。
 */
import { bindRulesetActionRequest } from "../../rulesets/action-request-bindings";
import type {
  ActionRequestConstructionInput,
  ActionRequestConstructionPort,
} from "../../domain/actions";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import { World } from "../../domain/world";
import { buildAgentVisibleEventFeed } from "../../agents/observation/event-feed";
import { buildTurnConstraintContext } from "./turn-constraints-context";

/**
 * 统一创建游戏对 Agent 的行动请求。
 *
 * 该工厂统一填入原生请求的日次、细粒度 stage、玩家可见事件与结构化行动约束；
 * 调用方提供机制附加数据，运行时权限仍由具体机制保存，不混入这些公共字段。
 * 事件输出按 actorId 投影；日次取构造输入，不从 World 当前时钟重新推断。
 * 完整数据先构造再绑定原请求对象，clone／约束／投影失败时不进入规则集绑定。
 */
export class GameActionRequestFactory implements ActionRequestConstructionPort {
  constructor(
    // 保留原 World／事件数组引用；readonly 仅限制这里的类型写法，不拍摄快照或冻结输入。
    private readonly world: World,
    private readonly events: readonly GameEvent[],
    private readonly day: number,
  ) {}

  create(input: ActionRequestConstructionInput): ActionRequest {
    // 先按原顺序复制 allowedTools，再克隆机制附加 context；运行句柄不可借公共数据副本成为凭据。
    // 后面的公共字段覆盖附加数据中同名字段；不提前缓存 input getter 或吞掉 clone 的原错误。
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
        // 等约束构造完成才复制当前事件数组并生成该演员视图，不将整份内部事件数组直接当成玩家事实。
        visible_events: buildAgentVisibleEventFeed(this.world, [...this.events], input.actorId),
      },
    };
    // 完整请求原对象交给各机制建立运行关联；ID／context／期限字段本身不能替代原对象绑定。
    // 原输入的阶段仍逐分支读取，不用已构造的 context.stage 替代后续 getter；World 也只在命中时读。
    // 绑定中抛错仍原样传播，已经建立的前面关联不由本工厂回滚。
    bindRulesetActionRequest(request, {
      stage: () => input.stage,
      world: () => this.world,
    });
    return request;
  }
}
