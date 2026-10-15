/**
 * 负责全天保护、自爆声明和实际回执的共享双语标签。输入严格惰性事实/语言，输出自然文字或null。
 * 私有决定、God细因与中性公开阻挡不混同；自爆声明只说明发动，真实death列表由已提交回执表达。
 */
import { readAwakenedGuardFact } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import { text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { deathCauses, factPlayers } from "./fact-details";
export function awakenedGuardEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readAwakenedGuardFact(type, payload);
  if (!f) return null;
  switch (f.type) {
    case "awakened_self_destruct_declared":
      return text(locale, "event.awakened_self_destruct_declared", {
        actor: f.payload.actorId,
        day: f.payload.day,
        window: term("stage", f.payload.window, locale),
      });
    case "awakened_self_destruct_resolved":
      return text(locale, "event.awakened_self_destruct_resolved", {
        actor: f.payload.actorId,
        day: f.payload.day,
        deaths: factPlayers(f.payload.deaths, locale),
        window: term("stage", f.payload.window, locale),
      });
    case "awakened_guard_cycle_started":
      return text(locale, "event.awakened_guard_cycle_started", {
        actor: f.payload.actorId,
        day: f.payload.day,
      });
    case "awakened_protection_chosen":
      return f.payload.mode === "protect"
        ? text(locale, "event.awakened_protect_chosen", {
            actor: f.payload.actorId,
            day: f.payload.day,
            target: f.payload.targetId!,
          })
        : text(
            locale,
            f.payload.mode === "pass"
              ? "event.awakened_protect_pass"
              : f.payload.outcome === "unused"
                ? "event.awakened_protect_unused"
                : "event.awakened_protect_wait",
            { actor: f.payload.actorId, day: f.payload.day },
          );
    case "awakened_protection_revealed":
      return text(locale, "event.awakened_protection_revealed", {
        actor: f.payload.actorId,
        target: f.payload.targetId,
      });
    case "awakened_protection_blocked":
      return text(locale, "event.awakened_protection_blocked", {
        day: f.payload.day,
        target: f.payload.targetId,
      });
    case "awakened_protection_block_detail":
      return text(locale, "event.awakened_protection_detail", {
        actor: f.payload.actorId,
        day: f.payload.day,
        target: f.payload.targetId,
        causes: deathCauses(f.payload.causes, locale),
        phase: term("phase", f.payload.phase, locale),
        root: term("phase", f.payload.rootPhase, locale),
      });
    case "awakened_protection_expired":
      return text(locale, "event.awakened_protection_expired", {
        actor: f.payload.actorId,
        day: f.payload.day,
      });
  }
}
