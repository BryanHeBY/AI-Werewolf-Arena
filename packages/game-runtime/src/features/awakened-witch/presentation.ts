/**
 * 负责把觉醒女巫完整脱离私态裁为本人已知选择，再用两语渲染资源和历史。
 * 输入只为纯数据/语言，输出不含协助讨论、批准或outcome；不读取World、授予窗口或修改库存。
 */
import {
  awakenedWitchResources,
  type AwakenedWitchState,
  type AwakenedWitchKnowledge,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

export function projectAwakenedWitchKnowledge(state: AwakenedWitchState): AwakenedWitchKnowledge {
  return {
    policy: state.policy,
    ...awakenedWitchResources(state),
    history: state.nights.map((n) =>
      n.mode === "poison"
        ? {
            day: n.day,
            mode: n.mode,
            targetId: n.targetId,
            ordinal: n.ordinal,
            assistantIds: [...n.assistantIds],
          }
        : { ...n },
    ),
  };
}
export function awakenedWitchPromptState(state: AwakenedWitchState | null, locale: Locale): string {
  if (!state) return text(locale, "role.awakened_witch.brief");
  const k = projectAwakenedWitchKnowledge(state),
    none = text(locale, "common.none");
  return (
    text(locale, "role.awakened_witch.brief") +
    " " +
    text(locale, "role.awakened_witch.state", {
      heal: k.healRemaining,
      brews: k.brewRemaining,
      assistants: k.usedAssistantIds.join(", ") || none,
      history:
        k.history
          .map((n) =>
            n.mode === "pass"
              ? text(locale, "awakened_witch.choice.pass", { day: n.day })
              : n.mode === "heal"
                ? text(locale, "awakened_witch.choice.heal", { day: n.day, target: n.targetId })
                : text(locale, "awakened_witch.choice.poison", {
                    day: n.day,
                    ordinal: n.ordinal,
                    target: n.targetId,
                    assistants: n.assistantIds.join(", "),
                  }),
          )
          .join("; ") || none,
    })
  );
}

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderAwakenedWitchStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  // 新族先用稳定工具数组筛选；不向旧请求增加context/getter查询，保原目标提示的读取顺序。
  if (request.allowedTools.includes("awakened_brew") && request.context.awakened_brew_options) {
    const o = request.context.awakened_brew_options,
      locale = queries.locale(),
      none = text(locale, "common.none");
    return text(locale, "prompt.stage.awakened_brew", {
      assistants: o.assistantIds.join(", ") || none,
      brews: o.brewRemaining,
      canHeal: text(locale, o.canHeal ? "common.yes" : "common.no"),
      canPoison: text(locale, o.canPoison ? "common.yes" : "common.no"),
      heal: o.healRemaining,
      knife: o.wolfTarget ?? none,
      required: o.requiredAssistants,
      targets: o.targetIds.join(", ") || none,
    });
  }
  if (
    request.allowedTools.some((t) => t === "brew_discuss" || t === "brew_approve") &&
    request.context.brew_collaboration
  ) {
    const g = request.context.brew_collaboration;
    return text(queries.locale(), "prompt.stage.brew_group", {
      assistants: g.assistantIds.join(", "),
      ordinal: g.ordinal,
      target: g.targetId,
    });
  }
}
