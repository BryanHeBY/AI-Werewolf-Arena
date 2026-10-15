/**
 * 负责觉醒决斗尝试、真实结算及链尾的共享双语标签。输入惰性事实/语言，输出自然说明或null。
 * committed只确认分支和已付尝试，resolved的actual deaths来自真实提交回执；链尾不自行flush遗言或判胜。
 */
import { readAwakenedDuelFact } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { factPlayers } from "./fact-details";
export function awakenedDuelEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readAwakenedDuelFact(type, payload);
  if (!f) return null;
  if (f.type === "awakened_duel_committed")
    return text(
      locale,
      f.payload.branch === "wolf" ? "event.awakened_duel_wolf" : "event.awakened_duel_good",
      { actor: f.payload.actorId, day: f.payload.day, target: f.payload.targetId },
    );
  if (f.type === "awakened_duel_resolved")
    return text(locale, "event.awakened_duel_resolved", {
      actor: f.payload.actorId,
      day: f.payload.day,
      target: f.payload.targetId,
      deaths: factPlayers(f.payload.deaths, locale),
    });
  return text(
    locale,
    f.payload.reason === "ended"
      ? "event.awakened_duel_ended"
      : f.payload.reason === "no_targets"
        ? "event.awakened_duel_no_targets"
        : f.payload.reason === "actor_lost"
          ? "event.awakened_duel_actor_lost"
          : "event.awakened_duel_miss",
    { actor: f.payload.actorId, day: f.payload.day },
  );
}
