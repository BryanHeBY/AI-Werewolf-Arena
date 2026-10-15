/**
 * 负责觉醒女巫五类私密事实的双语文案。输入纯载荷/语言，输出自然描述或拒绝。
 * 消费、协助者自己的票和God最终提案分开表述；不把已发起或某票同意说成真实死亡。
 * 本模块不推断历史受众、不查询身份，不翻译讨论原文；调用方仍须按历史受众隔离。
 */
import { readAwakenedWitchFact } from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
export function awakenedWitchEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readAwakenedWitchFact(type, payload);
  if (!fact) return null;
  switch (fact.type) {
    case "awakened_brew_chosen": {
      const p = fact.payload;
      if (p.mode === "pass")
        return text(locale, "event.awakened_brew_pass", { actor: p.actorId, day: p.day });
      if (p.mode === "heal")
        return text(locale, "event.awakened_brew_heal", {
          actor: p.actorId,
          day: p.day,
          target: p.targetId!,
        });
      return text(locale, "event.awakened_brew_poison", {
        actor: p.actorId,
        assistants: p.assistantIds.join(", "),
        day: p.day,
        ordinal: p.ordinal!,
        target: p.targetId!,
      });
    }
    case "brew_started":
      return text(locale, "event.brew_started", {
        assistants: fact.payload.assistantIds.join(", "),
        day: fact.payload.day,
        ordinal: fact.payload.ordinal,
        target: fact.payload.targetId,
      });
    case "brew_discussion":
      return text(locale, "event.brew_discussion", {
        actor: fact.payload.actorId,
        content: fact.payload.text,
        day: fact.payload.day,
        ordinal: fact.payload.ordinal,
      });
    case "brew_approval":
      return text(locale, fact.payload.approve ? "event.brew_approved" : "event.brew_vetoed", {
        actor: fact.payload.actorId,
        day: fact.payload.day,
        ordinal: fact.payload.ordinal,
      });
    case "brew_resolved":
      return fact.payload.outcome === "poison"
        ? text(locale, "event.brew_resolved_poison", {
            day: fact.payload.day,
            ordinal: fact.payload.ordinal,
            target: fact.payload.targetId,
          })
        : text(locale, "event.brew_resolved_vetoed", {
            day: fact.payload.day,
            ordinal: fact.payload.ordinal,
          });
  }
}
