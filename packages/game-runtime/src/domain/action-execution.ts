/**
 * 负责关联候选交付与随后机制执行的反馈。输入为真实请求身份、候选、已发表事件和中止信号，输出为一次性反馈与任务交接。
 * 只按对象身份绑定，不授予领域提交权，不读写角色或库存。模型任务先交出候选，继续持有会话和录制责任；
 * 机制边界发表结果后才结束工具等待。此通道独立于 Tape 交付结算，不混用完成身份。
 */
import type { ActionRequest, ToolCall } from "./actions";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { registerRequestAliasPropagation } from "./request-delivery";

export interface ExecutionFacts {
  kind: "resolved" | "committed";
  interrupted: boolean;
  events: readonly GameEvent[];
}
interface Exchange {
  tools: readonly string[];
  selected?: ToolCall;
  closed: boolean;
  deliver: (action: ToolCall) => void;
  selection: Promise<ToolCall>;
  finish: (facts: ExecutionFacts) => void;
  feedback: Promise<ExecutionFacts>;
  task?: Promise<ToolCall | null>;
}
const exchanges = new WeakMap<ActionRequest, Exchange>();
function inherit(original: ActionRequest, alias: ActionRequest): void {
  const exchange = exchanges.get(original);
  if (exchange) {
    exchanges.set(alias, exchange);
    registerRequestAliasPropagation(alias, 1000, inherit);
  }
}

/** 仅由机制执行作用域开放；相同字段的另一个对象不能获得通道。 */
export function openActionExecution(request: ActionRequest, tools: readonly string[]) {
  let deliver!: Exchange["deliver"], finish!: Exchange["finish"];
  const exchange: Exchange = {
    tools,
    closed: false,
    selection: new Promise((resolve) => {
      deliver = resolve;
    }),
    feedback: new Promise((resolve) => {
      finish = resolve;
    }),
    deliver: (value) => deliver(value),
    finish: (value) => finish(value),
  };
  exchanges.set(request, exchange);
  registerRequestAliasPropagation(request, 1000, inherit);
  return {
    get selected() {
      return exchange.selected;
    },
    async complete(facts: ExecutionFacts) {
      exchange.closed = true;
      exchange.finish(facts);
      // 等实际模型任务退出和录制完成，下一位玩家／同一会话才能接棒。
      await exchange.task;
    },
  };
}

/** 未开放反馈的脚本和旧单元调用保留原有 Promise 语义。 */
export function deliverActionSelection(
  request: ActionRequest,
  task: Promise<ToolCall | null>,
): Promise<ToolCall | null> {
  const exchange = exchanges.get(request);
  if (!exchange) return task;
  exchange.task = task;
  return Promise.race([task, exchange.selection]);
}

export function selectedExecutionAction(request: ActionRequest): ToolCall | undefined {
  return exchanges.get(request)?.selected;
}

/** 调用方必须已经通过 ActionTurn 预检。中止会唤醒等待，但不会撤回已交出的候选或退款。 */
export function awaitActionExecution(
  request: ActionRequest,
  action: ToolCall,
  signal?: AbortSignal,
): Promise<ExecutionFacts> | undefined {
  const exchange = exchanges.get(request);
  if (!exchange || exchange.closed || !exchange.tools.includes(action.name)) return;
  if (exchange.selected) throw new Error("action_execution_already_selected");
  exchange.selected = structuredClone(action);
  exchange.deliver(structuredClone(action));
  const abort = () => {
    exchange.closed = true;
    exchange.finish({ kind: "committed", interrupted: true, events: [] });
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  return exchange.feedback.finally(() => signal?.removeEventListener("abort", abort));
}
