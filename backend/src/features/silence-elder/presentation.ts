/**
 * 负责将禁言长老脱离的自身历史渲染为两语提示，输入为状态值或null及locale，输出自然语言。
 * 展示只消费已提交的本人选择，不读取World、运行窗口或目标真实身份，不授予再次选择/表达权限。
 */
import type { SilenceElderState } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

export function silenceElderPromptState(state: SilenceElderState | null, locale: Locale): string {
  const last = state?.history.at(-1);
  const choice = last
    ? text(locale, "silence.choice", {
        day: last.day,
        target: last.targetId,
        translator: last.translatorId ?? text(locale, "common.none"),
      })
    : text(locale, "common.none");
  return (
    text(locale, "role.silence_elder.brief") +
    " " +
    text(locale, "role.silence_elder.state", { choice })
  );
}

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderSilenceStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  if (request.allowedTools.includes("silence") && request.context.silence_candidates !== undefined)
    return text(queries.locale(), "prompt.stage.silence_candidates", {
      ids: request.context.silence_candidates.join(", "),
    });
  if (
    request.allowedTools.includes("gesture") &&
    request.context.stage === "silence_gesture" &&
    request.context.silence_target_id !== undefined
  )
    return text(queries.locale(), "prompt.stage.silence_gesture", {
      target: request.context.silence_target_id,
      round: text(
        queries.locale(),
        request.context.silence_round === "pk" ? "silence.round.pk" : "silence.round.day",
      ),
    });
  if (
    request.allowedTools.includes("translate_silence") &&
    request.context.stage === "silence_translation" &&
    request.context.silence_target_id !== undefined &&
    request.context.silence_gesture_description !== undefined
  )
    return text(queries.locale(), "prompt.stage.silence_translation", {
      target: request.context.silence_target_id,
      round: text(
        queries.locale(),
        request.context.silence_round === "pk" ? "silence.round.pk" : "silence.round.day",
      ),
      description: request.context.silence_gesture_description,
    });
}
