/**
 * 负责动物梦境事实的双语叙述，供终端、裁判记录和 Web 复盘共用。
 * 输入须通过原事实 reader；候选死亡与实际死亡分别描述，白猫延期不等于死亡。
 * 子狐命中只在 God 事实内描述，个人刀权通知不补充封刀来源；受众筛选仍归调用方。
 */
import { readAnimalDreamFact } from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { deathDetails, factList, factPlayer, factPlayers, nightChoice } from "./fact-details";

export function animalDreamEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readAnimalDreamFact(type, payload);
  if (!fact) return null;
  switch (fact.type) {
    case "animal_night_opened":
      return text(locale, "event.animal_night_opened", { day: fact.payload.day });
    case "animal_cat_revealed":
    case "animal_puffer_revealed":
      return text(locale, `event.${fact.type}`, { actor: fact.payload.actorId });
    case "animal_fox_chosen": {
      const p = fact.payload;
      return text(locale, "event.animal_fox_chosen", {
        actor: p.actorId,
        day: p.day,
        target: factPlayer(p.targetId, locale),
      });
    }
    case "animal_fox_effect": {
      const p = fact.payload;
      return text(locale, "event.animal_fox_effect", {
        actor: p.actorId,
        day: p.day,
        target: p.targetId,
        knife: text(
          locale,
          p.knifeBlocked ? "console.animal.blocked" : "console.animal.not_blocked",
        ),
        beauty: text(
          locale,
          p.beautyBlocked ? "console.animal.blocked" : "console.animal.not_blocked",
        ),
      });
    }
    case "animal_knife_notified": {
      const p = fact.payload;
      return text(
        locale,
        p.eligible ? "console.animal.knife_available" : "console.animal.knife_blocked",
        { actor: p.actorId, day: p.day },
      );
    }
    case "animal_beauty_notified": {
      const p = fact.payload;
      return text(locale, "event.animal_beauty_notified", {
        actor: p.actorId,
        day: p.day,
        target: factPlayer(p.targetId, locale),
        charm: text(
          locale,
          p.charmAllowed ? "console.animal.available" : "console.animal.unavailable",
        ),
        link: text(
          locale,
          p.linkAllowed ? "console.animal.available" : "console.animal.unavailable",
        ),
        last: p.lastActedDay ?? text(locale, "common.none"),
        history: factList(
          p.history.map((choice) => nightChoice(choice, locale)),
          locale,
        ),
      });
    }
    case "animal_puffer_decided": {
      const p = fact.payload;
      return text(locale, "event.animal_puffer_decided", {
        actor: p.actorId,
        day: p.day,
        decision: text(locale, p.activate ? "console.animal.activate" : "console.animal.pass"),
      });
    }
    case "animal_puffer_targets": {
      const p = fact.payload;
      return text(locale, "event.animal_puffer_targets", {
        actor: p.actorId,
        day: p.day,
        round: p.round,
        targets: factPlayers(p.targetIds, locale),
      });
    }
    case "animal_wave_prepared": {
      const p = fact.payload;
      return text(locale, "event.animal_wave_prepared", {
        day: p.day,
        phase: term("phase", p.phase, locale),
        proposed: factPlayers(p.proposedIds, locale),
        cat: factPlayer(p.blockedCatId, locale),
      });
    }
    case "animal_wave_committed": {
      const p = fact.payload;
      return text(locale, "event.animal_wave_committed", {
        day: p.day,
        phase: term("phase", p.phase, locale),
        deaths: deathDetails(p.deaths, p.deathSources, locale),
      });
    }
    case "animal_cat_expiry_prepared": {
      const p = fact.payload;
      return text(locale, "event.animal_cat_expiry_prepared", {
        actor: p.actorId,
        day: p.day,
        unit: p.unit,
        kind: text(locale, `animal.unit.${p.unitKind}`),
      });
    }
    case "animal_unit_completed": {
      const p = fact.payload;
      return text(locale, "event.animal_unit_completed", {
        day: p.day,
        unit: p.unit,
        kind: text(locale, `animal.unit.${p.kind}`),
      });
    }
  }
}
