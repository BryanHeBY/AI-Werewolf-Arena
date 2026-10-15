/**
 * 负责动物梦境行动与权限通知的终端文案。输入为事件名、纯数据载荷和语言，输出已校验事实的可读标签。
 * 本模块不决定受众；调用方继续按原 actor／God 分类和私有开关展示，回放标签与玩家投影保持独立。
 * 子狐实际命中与封刀原因只存在于 God 效果事实；本人刀权通知仅说明行动资格，不补充身份或来源。
 */
import { readAnimalDreamFact } from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

export function animalDreamLiveLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const fact = readAnimalDreamFact(type, payload);
  if (!fact) return null;
  switch (fact.type) {
    case "animal_fox_chosen": {
      const p = fact.payload;
      return text(locale, "console.animal.fox_choice", {
        actor: p.actorId,
        day: p.day,
        target: p.targetId ?? text(locale, "common.none"),
      });
    }
    case "animal_fox_effect": {
      const p = fact.payload;
      return text(locale, "console.animal.fox_effect", {
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
        {
          actor: p.actorId,
          day: p.day,
        },
      );
    }
    case "animal_beauty_notified": {
      const p = fact.payload;
      return text(locale, "console.animal.beauty", {
        actor: p.actorId,
        day: p.day,
        target: p.targetId ?? text(locale, "common.none"),
        charm: text(
          locale,
          p.charmAllowed ? "console.animal.available" : "console.animal.unavailable",
        ),
        link: text(
          locale,
          p.linkAllowed ? "console.animal.available" : "console.animal.unavailable",
        ),
      });
    }
    case "animal_puffer_decided": {
      const p = fact.payload;
      return text(locale, "console.animal.puffer_decision", {
        actor: p.actorId,
        day: p.day,
        decision: text(locale, p.activate ? "console.animal.activate" : "console.animal.pass"),
      });
    }
    case "animal_puffer_targets": {
      const p = fact.payload;
      return text(locale, "console.animal.puffer_targets", {
        actor: p.actorId,
        day: p.day,
        round: p.round,
        targets: p.targetIds.join(", ") || text(locale, "common.none"),
      });
    }
    default:
      return null;
  }
}
