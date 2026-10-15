/**
 * 负责觉醒狼美人本人资源与选择的纯双语提示。输入严格脱离私态/语言，输出历史与剩余替死说明。
 * 不包含God preventedCauses、原致死root或原体许可；完整receipt不经提示泄给本人、队友或目标。
 */
import type {
  AwakenedBeautyState,
  AwakenedBeautyKnowledge,
} from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
export function awakenedBeautyKnowledge(state: AwakenedBeautyState): AwakenedBeautyKnowledge {
  return {
    policy: state.policy,
    choices: state.choices.map((c) => ({ day: c.day, targetId: c.targetId })),
    replacementUsed: state.replacement !== null,
  };
}
export function awakenedBeautyPromptState(
  state: AwakenedBeautyState | null,
  locale: Locale,
): string {
  const brief = text(locale, "role.awakened_wolf_beauty.brief");
  if (!state) return brief;
  const k = awakenedBeautyKnowledge(state);
  return (
    brief +
    " " +
    text(locale, "role.awakened_wolf_beauty.state", {
      resource: text(
        locale,
        k.replacementUsed ? "awakened_beauty.resource.spent" : "awakened_beauty.resource.ready",
      ),
      choices:
        k.choices
          .map((c) =>
            c.targetId === null
              ? text(locale, "awakened_beauty.pass", { day: c.day })
              : text(locale, "awakened_beauty.choice", { day: c.day, target: c.targetId }),
          )
          .join("; ") || text(locale, "common.none"),
    })
  );
}
