/**
 * 负责原回合约束的数据解析、完成条件检查和是否允许回退的只读政策。
 * 输入为原请求、有效行动列表及 locale；输出保留原 min／max、必需工具、摘要与错误顺序。
 * 摘要文本和 MessageRef 的缺省规则、所需工具数组身份及消息克隆保持原语义；不读 World、
 * 不关闭请求、消耗库存或执行 Agent，提示文案的组织仍属于 AI 玩家层。
 */
import { text, type MessageRef, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest, ToolCall, ToolName } from "../../core/domain";

export interface ResolvedTurnConstraints {
  minValidActions: number;
  maxValidActions: number;
  requiredAnyTools: ToolName[];
  summary?: string;
  summaryMessage?: MessageRef;
}

export interface TurnConstraintState {
  validActions: ToolCall[];
}

export interface TurnConstraintEvaluation {
  ok: boolean;
  errors: string[];
}

/** 传输可按原策略重试；强制选择失败或显式禁止回退时，回退不能代补该行动。 */
export function allowsActionFallback(request: ActionRequest): boolean {
  return (
    request.context.action_failure_policy !== "error" && request.context.allow_fallback !== false
  );
}

/** 在原读取顺序解析引擎约束，保留摘要缺省、原数组引用和消息副本；不产生行动许可。 */
export function resolveTurnConstraints(request: ActionRequest): ResolvedTurnConstraints {
  const constraints = request.context.turn_constraints;
  const minValidActions = Math.max(0, Math.floor(constraints?.min_valid_actions ?? 0));
  const maxValidActions = Math.max(
    minValidActions,
    Math.floor(constraints?.max_valid_actions ?? 1),
  );
  const summary = constraints?.summary;
  return {
    minValidActions,
    maxValidActions,
    requiredAnyTools: constraints?.required_any_tools ?? [],
    ...(summary !== undefined ? { summary } : {}),
    ...(constraints?.summary_message
      ? { summaryMessage: structuredClone(constraints.summary_message) }
      : {}),
  };
}

/**
 * 校验当前回合是否满足结束条件。
 */
export function evaluateTurnConstraints(
  state: TurnConstraintState,
  constraints: ResolvedTurnConstraints,
  locale: Locale = "zh-CN",
): TurnConstraintEvaluation {
  const errors: string[] = [];
  if (state.validActions.length < constraints.minValidActions) {
    errors.push(text(locale, "turn.minimum", { count: constraints.minValidActions }));
  }
  if (state.validActions.length > constraints.maxValidActions) {
    errors.push(text(locale, "turn.maximum", { count: constraints.maxValidActions }));
  }
  if (constraints.requiredAnyTools.length > 0) {
    const used = new Set(state.validActions.map((action) => action.name));
    const hit = constraints.requiredAnyTools.some((tool) => used.has(tool));
    if (!hit) {
      errors.push(
        text(locale, "turn.required_tools", { tools: constraints.requiredAnyTools.join(", ") }),
      );
    }
  }
  return {
    ok: errors.length === 0,
    errors,
  };
}

