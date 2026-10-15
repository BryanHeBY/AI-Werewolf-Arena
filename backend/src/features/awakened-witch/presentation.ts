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
