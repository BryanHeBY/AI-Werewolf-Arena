/**
 * 负责觉醒狼美人的选择、God付款与公开替死结果标签。输入惰性载荷及语言，输出自然文案或null。
 * 一次付款不等于真实死亡，公开结果也不补写生命；受众和真正死亡由调用方的各自契约负责。
 */
import { type PlayerText } from "../players";
import { readAwakenedBeautyFact } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { text as defaultText, term, type Locale } from "@ai-werewolf-arena/game-text";
import { deathCauses } from "./fact-details";
export function awakenedBeautyEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string | null {
  const f = readAwakenedBeautyFact(type, payload);
  if (!f) return null;
  switch (f.type) {
    case "awakened_charm_chosen":
      return f.payload.targetId === null
        ? text(locale, "event.awakened_charm_passed", {
            actor: f.payload.actorId,
            day: f.payload.day,
          })
        : text(locale, "event.awakened_charm_chosen", {
            actor: f.payload.actorId,
            day: f.payload.day,
            target: f.payload.targetId,
            next: f.payload.nextAllowedNight,
          });
    case "awakened_beauty_replacement_paid":
      return text(locale, "event.awakened_beauty_replacement_paid", {
        actor: f.payload.actorId,
        day: f.payload.day,
        target: f.payload.targetId,
        causes: deathCauses(f.payload.preventedCauses, locale, text),
        phase: term("phase", f.payload.phase, locale),
        root: term("phase", f.payload.rootPhase, locale),
      });
    case "awakened_beauty_replaced":
      return text(
        locale,
        f.payload.targetDied
          ? "event.awakened_beauty_replaced"
          : "event.awakened_beauty_replacement_blocked",
        { actor: f.payload.actorId, day: f.payload.day, target: f.payload.targetId },
      );
  }
}
