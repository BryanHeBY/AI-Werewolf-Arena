import { ActionRequest, ToolCall, ToolName } from "../../../core/domain";

export interface ResolvedTurnConstraints {
  minValidActions: number;
  maxValidActions: number;
  requiredAnyTools: ToolName[];
  summary?: string;
}

export interface TurnConstraintState {
  validActions: ToolCall[];
}

export interface TurnConstraintEvaluation {
  ok: boolean;
  errors: string[];
}

/** Projects typed engine constraints into player prompt and tool-loop rules. */
export function resolveTurnConstraints(request: ActionRequest): ResolvedTurnConstraints {
  const constraints = request.context.turn_constraints;
  const minValidActions = Math.max(0, Math.floor(constraints?.min_valid_actions ?? 0));
  const maxValidActions = Math.max(minValidActions, Math.floor(constraints?.max_valid_actions ?? 1));
  const summary = constraints?.summary?.trim();
  return {
    minValidActions,
    maxValidActions,
    requiredAnyTools: constraints?.required_any_tools ?? [],
    ...(summary ? { summary } : {}),
  };
}

/**
 * 校验当前回合是否满足结束条件。
 */
export function evaluateTurnConstraints(
  state: TurnConstraintState,
  constraints: ResolvedTurnConstraints,
): TurnConstraintEvaluation {
  const errors: string[] = [];
  if (state.validActions.length < constraints.minValidActions) {
    errors.push(`本轮至少需要完成${constraints.minValidActions}次有效行动。`);
  }
  if (state.validActions.length > constraints.maxValidActions) {
    errors.push(`本轮最多允许${constraints.maxValidActions}次有效行动。`);
  }
  if (constraints.requiredAnyTools.length > 0) {
    const used = new Set(state.validActions.map((action) => action.name));
    const hit = constraints.requiredAnyTools.some((tool) => used.has(tool));
    if (!hit) {
      errors.push(
        `结束前必须至少执行以下工具之一：${constraints.requiredAnyTools.join(", ")}`,
      );
    }
  }
  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * 构建系统层规则文案。
 */
export function renderTurnConstraintSystemRule(
  constraints: ResolvedTurnConstraints,
): string {
  const base = `本轮行动约束：至少${constraints.minValidActions}次、至多${constraints.maxValidActions}次有效行动。`;
  const requiredTools =
    constraints.requiredAnyTools.length > 0
      ? ` 结束前至少执行以下工具之一：${constraints.requiredAnyTools.join(", ")}。`
      : "";
  const summary = constraints.summary ? ` ${constraints.summary}` : "";
  return `${base}${requiredTools}${summary}`;
}

/**
 * 构建用户层约束提示文案。
 */
export function renderTurnConstraintUserHint(
  constraints: ResolvedTurnConstraints,
): string {
  const requiredTools =
    constraints.requiredAnyTools.length > 0
      ? ` 且需命中工具：${constraints.requiredAnyTools.join(", ")}`
      : "";
  return `本轮结束前需满足：最少${constraints.minValidActions}次、最多${constraints.maxValidActions}次有效行动${requiredTools}。`;
}
