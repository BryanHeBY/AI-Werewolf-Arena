/**
 * 负责双端复制、赠予、枪及特殊能力事件的展示映射。输入是事件类型、公开契约读取的数据和语言；输出为原事件标签或原未知回退。复制与付款、效果生效及玩家信息授权不属于展示层，库存和原始用户文本保持。
 */
import {
  AWAKENED_EVENT_TYPES,
  readAwakenedEventFact,
} from "@ai-werewolf-arena/game-contract/facts/awakened";
import {
  MECHANICAL_EVENT_TYPES,
  readMechanicalEventFact,
} from "@ai-werewolf-arena/game-contract/facts/mechanical";
import {
  readMerchantRenderableFact,
  readMerchantOutcome,
} from "@ai-werewolf-arena/game-contract/facts/merchant";
import { readDeathAbilityEventFact } from "@ai-werewolf-arena/game-contract/facts/death-ability";
import {
  readBlackMarketRenderableFact,
  readBlackMarketOutcome,
} from "@ai-werewolf-arena/game-contract/facts/black-market";
import type { MessageKey } from "@ai-werewolf-arena/game-contract";
import { type Locale } from "@ai-werewolf-arena/game-contract";
import { text, roleName } from "@ai-werewolf-arena/game-text";

export function awakenedEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(AWAKENED_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readAwakenedEventFact(type, payload);
  if (!fact) return unknown();
  const actor = fact.actorId;
  switch (fact.type) {
    case "awakened_inherited":
      return text(locale, "console.awakened.inherited", {
        actor,
        day: fact.day,
        first: fact.firstKnifeNight,
      });
    case "awakened_mimicked":
      return text(locale, "console.awakened.mimic", {
        actor,
        day: fact.day,
        target: fact.targetId,
        role: roleName(fact.role, locale),
      });
    case "awakened_ready":
      return text(locale, "console.awakened.ready", {
        actor,
        activation: fact.activationNight,
        ready: fact.activeFromNight,
        role: roleName(fact.role, locale),
      });
    case "awakened_mimic_skipped":
      return text(locale, "console.awakened.mimic_skip", { actor, day: fact.day });
    case "awakened_skill_skipped":
      return text(locale, "console.awakened.skill_skip", { actor, day: fact.day });
    case "awakened_poison_used":
      return text(locale, "console.awakened.poison", {
        actor,
        day: fact.day,
        target: fact.targetId,
      });
    case "awakened_guard_chosen":
    case "awakened_attack_chosen":
      return text(
        locale,
        fact.type === "awakened_guard_chosen"
          ? "console.awakened.guard"
          : "console.awakened.attack",
        { actor, day: fact.day, target: fact.targetId ?? text(locale, "common.none") },
      );
  }
  return unknown();
}

export function mechanicalEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  if (!(MECHANICAL_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readMechanicalEventFact(type, payload);
  if (!fact) return unknown();
  const actor = fact.actorId;
  switch (fact.type) {
    case "mechanical_awakened":
      return text(locale, "console.mechanical.awakened", {
        actor,
        day: fact.day,
        first: fact.firstKnifeNight,
      });
    case "mechanical_mode_selected":
      return text(locale, "console.mechanical.mode", {
        actor,
        day: fact.day,
        mode: text(locale, fact.mode === "kill" ? "mechanical.mode.kill" : "mechanical.mode.skill"),
      });
    case "mechanical_mimicked":
      return text(locale, "console.mechanical.mimic", {
        actor,
        day: fact.day,
        target: fact.targetId,
        role: roleName(fact.role, locale),
        ready: fact.readyOnNight,
      });
    case "mechanical_mimic_skipped":
      return text(locale, "console.mechanical.mimic_skip", { actor, day: fact.day });
    case "mechanical_skill_skipped":
      return text(locale, "console.mechanical.skill_skip", { actor, day: fact.day });
    case "mechanical_poison_used":
      return text(locale, "console.mechanical.poison", {
        actor,
        day: fact.day,
        target: fact.targetId,
      });
    case "mechanical_guard_chosen":
      return text(locale, "console.mechanical.guard", {
        actor,
        day: fact.day,
        target: fact.targetId ?? text(locale, "common.none"),
        failed: text(locale, fact.failed ? "common.yes" : "common.no"),
      });
    case "mechanical_attack_chosen":
      return text(locale, "console.mechanical.attack", {
        actor,
        day: fact.day,
        target: fact.targetId ?? text(locale, "common.none"),
      });
    case "mechanical_poison_reflected":
      return text(locale, "console.mechanical.reflection", {
        actor,
        day: fact.day,
        target: fact.protectedTargetId,
        caster: fact.casterId,
      });
    case "mechanical_shot":
      return text(locale, "console.mechanical.shot", { actor, target: fact.targetId });
    default:
      return unknown();
  }
}

export function merchantEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (
    !["merchant_trade_committed", "merchant_trade_skipped", "merchant_trade_resolved"].includes(
      type,
    )
  )
    return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readMerchantRenderableFact(type, payload);
  if (!fact) return unknown();
  const actor = fact.actorId,
    day = fact.day;
  if (fact.type === "merchant_trade_skipped")
    return text(locale, "console.merchant.skip", { actor, day });
  const skill = text(
      locale,
      fact.skill === "check"
        ? "merchant.skill.check"
        : fact.skill === "poison"
          ? "merchant.skill.poison"
          : "merchant.skill.guard",
    ),
    target = fact.targetId;
  if (fact.type === "merchant_trade_committed")
    return text(locale, "console.merchant.trade", { actor, day, target, skill });
  const outcome = readMerchantOutcome(fact.outcome);
  return outcome !== null
    ? text(locale, "console.merchant.outcome", {
        actor,
        day,
        target,
        skill,
        outcome: text(
          locale,
          outcome === "granted" ? "merchant.outcome.granted" : "merchant.outcome.backlash",
        ),
      })
    : unknown();
}

export function deathAbilityEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  if (type !== "death_ability_changed") return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readDeathAbilityEventFact(type, payload);
  if (!fact) return unknown();
  return text(locale, "ability.death_gun.change", {
    actor: fact.actorId,
    id: fact.abilityId,
    operation: text(locale, `ability.operation.${fact.operation}` as MessageKey),
  });
}

export function blackMarketEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  if (
    ![
      "black_market_trade_committed",
      "black_market_trade_skipped",
      "black_market_trade_resolved",
    ].includes(type)
  )
    return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readBlackMarketRenderableFact(type, payload);
  if (!fact) return unknown();
  if (fact.type === "black_market_trade_skipped")
    return text(locale, "console.black_market.skip", { actor: fact.actorId, day: fact.day });
  const args = {
    actor: fact.actorId,
    day: fact.day,
    target: fact.targetId,
    skill: text(locale, `black_market.skill.${fact.skill}` as MessageKey),
  };
  if (fact.type === "black_market_trade_committed")
    return text(locale, "console.black_market.choice", args);
  const outcome = readBlackMarketOutcome(fact.outcome);
  return outcome !== null
    ? text(locale, "console.black_market.result", {
        ...args,
        outcome: text(
          locale,
          outcome === "granted" ? "merchant.outcome.granted" : "merchant.outcome.backlash",
        ),
      })
    : unknown();
}
