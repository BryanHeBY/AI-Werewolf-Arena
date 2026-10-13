/**
 * 提供不依赖角色策略的空行动与一次性脚本驱动。输入为引擎请求和预置匹配条目，
 * 输出为空动作或首个命中的原动作；脚本命中即从本驱动队列移除，不能据此视为领域已提交。
 * 仅管理本地脚本副本，不读取 World、调用模型或推导角色权限；特权基线决策归游戏驱动。
 */
import type { ActionProvider, ActionRequest, ToolCall } from "../../../core/domain";

/**
 * Noop 行为提供器：用于测试“无人行动”场景。
 */
export class NoopActionProvider implements ActionProvider {
  /**
   * 恒定返回空动作，用于测试空行动分支。
   */
  async getAction(_request: ActionRequest): Promise<ToolCall | null> {
    return null;
  }
}

/**
 * 脚本动作匹配条目。
 */
export interface ScriptedEntry {
  match: (request: ActionRequest) => boolean;
  action: ToolCall | null;
}

/**
 * Scripted 行为提供器：按预置脚本回放动作，适合单元测试与复现 bug。
 */
export class ScriptedActionProvider implements ActionProvider {
  private readonly entries: ScriptedEntry[];

  constructor(entries: ScriptedEntry[]) {
    this.entries = [...entries];
  }

  /**
   * 按首个命中规则返回脚本动作，并移除该规则避免重复触发。
   */
  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const index = this.entries.findIndex((entry) => entry.match(request));
    if (index === -1) {
      return null;
    }

    const [entry] = this.entries.splice(index, 1);
    return entry.action;
  }
}
