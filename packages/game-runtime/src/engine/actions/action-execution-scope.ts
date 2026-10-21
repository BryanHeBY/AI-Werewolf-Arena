/**
 * 负责一个机制步骤内的反馈作用域。输入为行动提供者、事件序列、机制程序和工具反馈政策，输出为原机制结果与执行反馈。
 * 只收集已发表事件，绝不从候选推算结果或再次执行行动。下一个请求前收口上一请求，步骤结束／异常时收口剩余请求；
 * 不处理资源退款，不授予角色或目标资格，领域错误与反馈错误都向原调用方传播。
 */
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider, ActionRequest } from "../../domain/actions";
import { openActionExecution } from "../../domain/action-execution";
import { getDefaultToolSpecRegistry, type ToolSpecRegistry } from "./tool-spec-registry";

export async function withActionExecutionScope<T>(
  provider: ActionProvider,
  events: readonly GameEvent[],
  execute: (provider: ActionProvider) => Promise<T>,
  specs: ToolSpecRegistry = getDefaultToolSpecRegistry(),
): Promise<T> {
  let accepting = true;
  let selecting = false;
  const pending = new Set<{
    request: ActionRequest;
    start: number;
    channel: ReturnType<typeof openActionExecution>;
    ready: boolean;
  }>();
  const flush = async (interrupted: boolean) => {
    const ready = [...pending].filter((entry) => interrupted || entry.ready);
    for (const entry of ready) pending.delete(entry);
    const settled = await Promise.allSettled(
      ready.map(async ({ request, start, channel }) => {
        const policy = channel.selected && specs.get(channel.selected.name)?.executionFeedback;
        const facts = policy
          ? events
              .slice(start)
              .filter(
                (event) =>
                  policy.events.includes(event.type) &&
                  "actorId" in event.payload &&
                  event.payload.actorId === request.actorId &&
                  (!request.context.ability_id ||
                    !("abilityId" in event.payload) ||
                    event.payload.abilityId === request.context.ability_id),
              )
          : [];
        await channel.complete({ kind: policy?.kind ?? "committed", interrupted, events: facts });
      }),
    );
    const errors = settled.flatMap((item) => (item.status === "rejected" ? [item.reason] : []));
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, "action_execution_feedback_failed");
  };
  const invoke = Reflect.apply.bind(Reflect);
  const wrapped: ActionProvider = {
    get getAction() {
      // 在领域原来的方法准备点读取真实 callee；getter 撤权须仍先于领域最后守卫被观察。
      const getAction = provider.getAction;
      return async (request: ActionRequest) => {
        if (!accepting) throw new Error("action_execution_scope_closed");
        if (pending.size) await flush(false);
        if (!accepting) throw new Error("action_execution_scope_closed");
        if (!request.allowedTools.some((name) => specs.get(name)?.executionFeedback))
          return invoke(getAction, provider, [request]);
        // 这些机制按玩家逐次提交；并发等待会与模型限流槽构成环，明确拒绝而非等到超时。
        if (selecting) throw new Error("action_execution_requires_serial_requests");
        selecting = true;
        const entry = {
          request,
          start: events.length,
          channel: openActionExecution(
            request,
            request.allowedTools.filter((name) => specs.get(name)?.executionFeedback),
          ),
          ready: false,
        };
        pending.add(entry);
        try {
          return await invoke(getAction, provider, [request]);
        } finally {
          entry.ready = true;
          selecting = false;
        }
      };
    },
  };
  let result: T;
  try {
    result = await execute(wrapped);
  } catch (error) {
    accepting = false;
    try {
      await flush(true);
    } catch (feedbackError) {
      if (feedbackError === error) throw error;
      throw new AggregateError([error, feedbackError], "action_execution_and_feedback_failed", {
        cause: error,
      });
    }
    throw error;
  }
  accepting = false;
  await flush(false);
  return result;
}
