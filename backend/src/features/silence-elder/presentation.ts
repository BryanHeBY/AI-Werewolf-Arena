/**
 * 负责将禁言长老脱离的自身历史渲染为两语提示，输入为状态值或null及locale，输出自然语言。
 * 展示只消费已提交的本人选择，不读取World、运行窗口或目标真实身份，不授予再次选择/表达权限。
 */
import type { SilenceElderState } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
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
