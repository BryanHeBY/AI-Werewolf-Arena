/**
 * 持有测试驱动：严格执行外部行动脚本并记录已消耗步骤，预期仍为调用方字面步骤。输入为脚本、回调或夹具资源请求，输出为原受控轨迹、句柄和响应；单元／场景预期仍由调用方给出。迁移不改变所有权、清理或错误政策，不引入计费模型。
 */
import type { ActionProvider, ActionRequest, ActionStage, ToolCall } from "../../../src/domain";

export interface ScriptStep {
  actorId: number;
  day: number;
  stage: ActionStage;
  /**
   * 该玩家在指定 day／stage 内的序号，不受其他玩家影响。
   */
  turn: number;
  action: ToolCall | null;
  assertRequest?: (request: ActionRequest) => void;
}

const stepKey = (step: Pick<ScriptStep, "actorId" | "day" | "stage" | "turn">) =>
  `${step.actorId}/${step.day}/${step.stage}/${step.turn}`;

/**
 * 只替换决策；多出或缺失的请求不能用默认行动掩盖。
 */
export class StrictScriptedPlayers implements ActionProvider {
  readonly trace: Array<{ request: ActionRequest; action: ToolCall | null }> = [];
  private readonly steps = new Map<string, ScriptStep>();
  private readonly consumed = new Set<string>();
  private readonly counters = new Map<string, number>();

  constructor(steps: readonly ScriptStep[]) {
    for (const step of steps) {
      const key = stepKey(step);
      if (this.steps.has(key)) throw new Error(`script_duplicate_step: ${key}`);
      this.steps.set(key, step);
    }
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const base = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    const turn = (this.counters.get(base) ?? 0) + 1;
    this.counters.set(base, turn);
    const key = `${base}/${turn}`;
    const step = this.steps.get(key);
    if (!step) throw new Error(`script_unexpected_request: ${key}`);
    step.assertRequest?.(request);
    this.consumed.add(key);
    const action = structuredClone(step.action);
    this.trace.push({ request: structuredClone(request), action: structuredClone(action) });
    return action;
  }

  assertConsumed(): void {
    const missing = [...this.steps.keys()].filter((key) => !this.consumed.has(key));
    if (missing.length) throw new Error(`script_missing_requests: ${missing.join(", ")}`);
  }
}
