/** 负责典狱长已发表秘密事实的共享双语展示；输入为严格纯载荷及语言，输出自然文案或null，不决定受众或推断参与者身份。 */
import { type PlayerText } from "../players";
import { readWardenFact } from "@ai-werewolf-arena/game-contract/facts/warden";
import { text as defaultText, type Locale } from "@ai-werewolf-arena/game-text";
import { factPlayers } from "./fact-details";
export function wardenEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string | null {
  const f = readWardenFact(type, payload);
  if (!f) return null;
  switch (f.type) {
    case "warden_pair_chosen":
      return text(locale, "event.warden_pair_chosen", {
        actor: f.payload.actorId,
        day: f.payload.day,
        pair: factPlayers(f.payload.pair ?? [], locale, text),
      });
    case "warden_partner_notified":
      return text(locale, "event.warden_partner_notified", {
        actor: f.payload.actorId,
        day: f.payload.day,
        partner: f.payload.partnerId,
      });
    case "warden_decision":
      return text(locale, "event.warden_decision", {
        actor: f.payload.actorId,
        day: f.payload.day,
        choice: text(
          locale,
          f.payload.choice === "trade" ? "warden.choice.trade" : "warden.choice.betray",
        ),
      });
    case "warden_resolved":
      return text(locale, "event.warden_resolved", {
        day: f.payload.day,
        pair: factPlayers(f.payload.pair, locale, text),
        deaths: factPlayers(f.payload.dealIds, locale, text),
        outcome: text(
          locale,
          f.payload.outcome === "protect"
            ? "warden.outcome.protect"
            : f.payload.outcome === "force"
              ? "warden.outcome.force"
              : "warden.outcome.deal",
        ),
      });
  }
}
