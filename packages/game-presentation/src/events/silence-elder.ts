/**
 * 负责禁言长老共享自然语言事件展示；输入为已解析纯载荷、机器类型与locale，输出双语标签或null。
 * 严格事实读器先裁定字段；动作与译文按原文保留，文本不会重建许可或被当作引擎确认事实。
 * 终端和Web共用标签，受众过滤仍由调用方拥有，不读取World、库存或目标私有状态。
 */
import { readSilenceElderFact } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
export function silenceElderEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readSilenceElderFact(type, payload);
  if (!f) return null;
  switch (f.type) {
    case "silence_chosen":
      return text(locale, "event.silence_chosen", {
        actor: f.payload.actorId,
        day: f.payload.day,
        target: f.payload.targetId,
        translator: f.payload.translatorId ?? text(locale, "common.none"),
      });
    case "silence_announced":
      return text(locale, "event.silence_announced", {
        day: f.payload.day,
        target: f.payload.targetId,
        translator: f.payload.translatorId ?? text(locale, "common.none"),
      });
    case "silence_gesture":
      return text(locale, "event.silence_gesture", {
        actor: f.payload.actorId,
        round: text(locale, f.payload.round === "day" ? "silence.round.day" : "silence.round.pk"),
        description: f.payload.description,
      });
    case "silence_translated":
      return text(locale, "event.silence_translated", {
        actor: f.payload.actorId,
        target: f.payload.targetId,
        round: text(locale, f.payload.round === "day" ? "silence.round.day" : "silence.round.pk"),
        text: f.payload.text,
      });
    case "silence_translation_declined":
      return text(locale, "event.silence_translation_declined", {
        actor: f.payload.actorId,
        target: f.payload.targetId,
        round: text(locale, f.payload.round === "day" ? "silence.round.day" : "silence.round.pk"),
      });
    case "silence_expired":
      return text(locale, "event.silence_expired", {
        day: f.payload.day,
        target: f.payload.targetId,
      });
  }
}
