import { renderMessage, text, type MessageRef, type Locale } from "@ai-werewolf-arena/game-text";
import { ActionRequest, ToolCall, ToolName } from "../../../core/domain";

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

/** Transport retries may continue, but a failed mandatory choice cannot be supplied by a fallback. */
export function allowsActionFallback(request: ActionRequest): boolean {
  return request.context.allow_fallback !== false;
}

/** Projects typed engine constraints into player prompt and tool-loop rules. */
export function resolveTurnConstraints(request: ActionRequest): ResolvedTurnConstraints {
  const constraints = request.context.turn_constraints;
  const minValidActions = Math.max(0, Math.floor(constraints?.min_valid_actions ?? 0));
  const maxValidActions = Math.max(minValidActions, Math.floor(constraints?.max_valid_actions ?? 1));
  const summary = constraints?.summary;
  return {
    minValidActions,
    maxValidActions,
    requiredAnyTools: constraints?.required_any_tools ?? [],
    ...(summary !== undefined ? { summary } : {}),
    ...(constraints?.summary_message ? { summaryMessage: structuredClone(constraints.summary_message) } : {}),
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

/** Human text uses the same immutable locale as this player's prompt. */
export function renderTurnConstraintSystemRule(constraints: ResolvedTurnConstraints, locale: Locale = "zh-CN"): string {
  return [text(locale, "turn.system", { min: constraints.minValidActions, max: constraints.maxValidActions }),
    ...(constraints.requiredAnyTools.length ? [text(locale, "turn.required_tools", { tools: constraints.requiredAnyTools.join(", ") })] : []),
    ...(constraints.summary !== undefined ? (constraints.summary ? [constraints.summary] : []) : constraints.summaryMessage ? [renderMessage(locale, constraints.summaryMessage)] : []),
  ].join(" ");
}

export function renderTurnConstraintUserHint(constraints: ResolvedTurnConstraints, locale: Locale = "zh-CN"): string {
  const hint = text(locale, "turn.user", { min: constraints.minValidActions, max: constraints.maxValidActions,
    required: constraints.requiredAnyTools.length ? text(locale, "turn.required_suffix", { tools: constraints.requiredAnyTools.join(", ") }) : "" });
  const summary = constraints.summary !== undefined ? constraints.summary : constraints.summaryMessage ? renderMessage(locale, constraints.summaryMessage) : undefined;
  return summary ? `${hint} ${summary}` : hint;
}
