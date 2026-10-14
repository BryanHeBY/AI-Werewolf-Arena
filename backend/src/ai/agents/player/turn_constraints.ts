/**
 * 负责把已解析的回合约束组织为玩家系统规则和用户提示；输入为原约束数据与固定 locale。
 * 输出保留原多语言文本、摘要优先级和连接顺序；不解析许可、校验候选、接收动作或写入 World。
 * 游戏侧独立持有约束解析／评估，此模块只在原提示构造时点渲染字符串。
 */
import { renderMessage, text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ResolvedTurnConstraints } from "../../../game/gateway/turn-constraints";

/** 文案使用与本玩家提示相同的固定 locale；已有 summary 即便空串也优先于消息引用。 */
export function renderTurnConstraintSystemRule(
  constraints: ResolvedTurnConstraints,
  locale: Locale = "zh-CN",
): string {
  return [
    text(locale, "turn.system", {
      min: constraints.minValidActions,
      max: constraints.maxValidActions,
    }),
    ...(constraints.requiredAnyTools.length
      ? [text(locale, "turn.required_tools", { tools: constraints.requiredAnyTools.join(", ") })]
      : []),
    // summary !== undefined 优先于 MessageRef；空串会省略这一段，但不能再从引用补文案。
    ...(constraints.summary !== undefined
      ? constraints.summary
        ? [constraints.summary]
        : []
      : constraints.summaryMessage
        ? [renderMessage(locale, constraints.summaryMessage)]
        : []),
  ].join(" ");
}

/** 先形成原基础 hint 再选择 summary；空串优先且不追加，格式化失败原样抛，不触发重试或补执行动作。 */
export function renderTurnConstraintUserHint(
  constraints: ResolvedTurnConstraints,
  locale: Locale = "zh-CN",
): string {
  const hint = text(locale, "turn.user", {
    min: constraints.minValidActions,
    max: constraints.maxValidActions,
    required: constraints.requiredAnyTools.length
      ? text(locale, "turn.required_suffix", { tools: constraints.requiredAnyTools.join(", ") })
      : "",
  });
  const summary =
    constraints.summary !== undefined
      ? constraints.summary
      : constraints.summaryMessage
        ? renderMessage(locale, constraints.summaryMessage)
        : undefined;
  return summary ? `${hint} ${summary}` : hint;
}
