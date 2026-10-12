/**
 * Public text and compatibility exit consumed by backend and browser rendering.
 * Exports frozen bilingual dictionaries, strict formatting, presentation mappings
 * and the existing fact compatibility contributions. Machine message IDs and references
 * are contract-owned named type exports; formatting retains parameter validation
 * and raw user text. This module never grants engine action or resource authority.
 */
import { readHybridEventFact } from "@ai-werewolf-arena/game-contract/facts/hybrid";
import {
  AWAKENED_EVENT_TYPES,
  readAwakenedEventFact,
} from "@ai-werewolf-arena/game-contract/facts/awakened";
export { AWAKENED_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/awakened";
import {
  MECHANICAL_EVENT_TYPES,
  readMechanicalEventFact,
} from "@ai-werewolf-arena/game-contract/facts/mechanical";
export { MECHANICAL_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/mechanical";
import {
  readMerchantRenderableFact,
  readMerchantOutcome,
} from "@ai-werewolf-arena/game-contract/facts/merchant";
import { readDeathAbilityEventFact } from "@ai-werewolf-arena/game-contract/facts/death-ability";
import {
  readBlackMarketRenderableFact,
  readBlackMarketOutcome,
} from "@ai-werewolf-arena/game-contract/facts/black-market";
import type { MessageKey, MessageRef } from "@ai-werewolf-arena/game-contract";
import { readNobleSecretBodyFact } from "./noble-secret-body";
import { readAnimalDreamFact } from "./animal-dream";
export * from "./animal-dream";
import { readFragrantPairFact } from "./fragrant-pair-seer";
import { readRadiantEclipseFact } from "./radiant-eclipse";
import { readMistRavenFact } from "./mist-raven";
import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierConflictFact,
  readModifierBonusFact,
} from "./scholar-mentor";
import {
  readTimeConsortChoiceFact,
  readTimeConsortSkipFact,
  readTimeConsortReflectionFact,
} from "./time-consort";
import { readWolfSorcererExchangeFact, readWolfSorcererSkipFact } from "./wolf-sorcerer";
import {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
} from "./trickster";
import { readOrderPrinceChoiceFact } from "./order-prince";
import { readRedMoonNextNightFact, readRedMoonExpiryFact } from "./red-moon";
import { readWildChildEventFact, readWildChildPlayerFact } from "./wild-child";
export {
  readWildChildEventFact,
  readWildChildPlayerFact,
  WILD_CHILD_EVENT_TYPES,
} from "./wild-child";
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
import { readShapeshifterEventFact } from "./shapeshifter";
export {
  readShapeshifterEventFact,
  readShapeshifterChoiceTool,
  SHAPESHIFTER_EVENT_TYPES,
} from "./shapeshifter";
import { readThiefEventFact } from "./thief";
export { readThiefEventFact, THIEF_EVENT_TYPES } from "./thief";
export { copyEventData } from "./event-data";
import { readWallEventFact } from "./wall-notes";
export {
  WALL_EVENT_TYPES,
  readWallEventFact,
  validWallText,
  readWallTool,
  readWallNoteData,
} from "./wall-notes";
import {
  isLocale,
  roleName as catalogRoleName,
  type Locale,
  type InspectionResult,
  type GameOutcome,
  type VictoryClaim,
  type VictoryPoint,
} from "@ai-werewolf-arena/game-catalog";
import { DEBATE_EVENT_TYPES, readDebateEventFact } from "./debate";
export { DEBATE_EVENT_TYPES, readDebateEventFact } from "./debate";
import { CUPID_EVENT_TYPES, readCupidEventFact } from "./cupid";
export { CUPID_EVENT_TYPES, readCupidEventFact } from "./cupid";
import { zhCN } from "./zh-CN";
import { en } from "./en";

export type { Locale, MessageKey, MessageRef };
export const dictionaries = Object.freeze({ "zh-CN": zhCN, en });
const placeholderPattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(placeholderPattern)].map((match) => match[1]))].sort();
}

/** Locale is a value on each call; there is no mutable process-wide language. */
export function text(
  locale: Locale,
  key: MessageKey,
  parameters: Readonly<Record<string, string | number>> = {},
): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  if (!Object.hasOwn(dictionaries[locale], key)) throw new Error(`i18n_key_missing: ${key}`);
  const template = dictionaries[locale][key];
  if (template === undefined) throw new Error(`i18n_key_missing: ${key}`);
  const expected = placeholders(template);
  for (const name of expected) {
    if (!Object.hasOwn(parameters, name)) throw new Error(`i18n_parameter_missing: ${key}.${name}`);
    const value = parameters[name];
    if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value)))
      throw new Error(`i18n_parameter_invalid: ${key}.${name}`);
  }
  for (const name of Object.keys(parameters))
    if (!expected.includes(name)) throw new Error(`i18n_parameter_unused: ${key}.${name}`);
  return template.replace(placeholderPattern, (_match, name: string) => String(parameters[name]));
}

export function roleName(id: string, locale: Locale = "zh-CN"): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  return catalogRoleName(id, locale);
}
export function term(
  kind: "camp" | "camp_team" | "phase" | "stage" | "potion" | "reason" | "rule" | "tie",
  id: string,
  locale: Locale = "zh-CN",
): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  const key = `${kind}.${id}` as MessageKey;
  return Object.hasOwn(zhCN, key) ? text(locale, key) : id;
}

export function inspectionLabel(result: InspectionResult, locale: Locale = "zh-CN"): string {
  if (result.kind === "camp") return term("camp", result.camp, locale);
  if (result.kind === "role") return roleName(result.role, locale);
  return text(locale, "inspection.combined", {
    role: roleName(result.role, locale),
    camp: term("camp", result.camp, locale),
  });
}

export function validateDictionaries(): void {
  const expected = Object.keys(zhCN).sort();
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    if (JSON.stringify(Object.keys(dictionary).sort()) !== JSON.stringify(expected))
      throw new Error(`i18n_key_set_mismatch: ${locale}`);
    for (const key of expected as MessageKey[]) {
      if (!dictionary[key].trim()) throw new Error(`i18n_text_empty: ${locale}.${key}`);
      if (JSON.stringify(placeholders(dictionary[key])) !== JSON.stringify(placeholders(zhCN[key])))
        throw new Error(`i18n_placeholder_mismatch: ${locale}.${key}`);
    }
  }
}

/** Machine error IDs stay stable; render only their human explanation. */
export function errorMessage(locale: Locale, code: string): string {
  const key = `error.${code}` as MessageKey;
  return Object.hasOwn(zhCN, key)
    ? text(locale, key)
    : text(locale, "tool.unknown_error", { code });
}

/** God labels describe membership separately from physical role/camp and never imply death. */
export function hybridEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (type !== "hybrid_exemplar_chosen" && type !== "hybrid_affiliation_resolved") return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readHybridEventFact(type, payload);
  if (!fact) return unknown();
  const parameters = { actor: fact.actorId, day: fact.day, target: fact.targetId };
  if (fact.type === "hybrid_exemplar_chosen")
    return text(locale, "console.hybrid.choice", parameters);
  return text(locale, "console.hybrid.affiliation", {
    ...parameters,
    faction: term("camp", fact.faction, locale),
  });
}
export function cupidEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(CUPID_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const p = readCupidEventFact(type, payload);
  if (!p) return text(locale, "replay.unknown");
  const actor = p.actorId as number;
  if (type === "lover_recognized")
    return text(locale, "console.cupid.recognition", { actor, partner: p.partnerId as number });
  if (type === "lovers_death")
    return text(locale, "console.cupid.death", { actor, target: p.targetId as number });
  const pair = p.pairIds as number[];
  if (type === "cupid_lovers_chosen")
    return text(locale, "console.cupid.choice", { actor, first: pair[0]!, second: pair[1]! });
  const camps = p.pairCamps as string[];
  return text(locale, "console.cupid.resolved", {
    actor,
    first: pair[0]!,
    second: pair[1]!,
    firstCamp: term("camp", camps[0]!, locale),
    secondCamp: term("camp", camps[1]!, locale),
    policy: term("rule", p.policy as string, locale),
    mixed: text(locale, p.mixed ? "common.yes" : "common.no"),
  });
}
export function debateEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(DEBATE_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const p = readDebateEventFact(type, payload);
  if (!p) return text(locale, "replay.unknown");
  const actor = p.actorId as number;
  if (type === "debater_revealed") return text(locale, "console.debate.reveal", { actor });
  if (type === "debate_speech")
    return text(locale, "console.debate.speech", { actor, speech: p.text as string });
  const target = p.targetId as number;
  if (type === "debate_started") return text(locale, "console.debate.start", { actor, target });
  if (type === "debate_canceled") return text(locale, "console.debate.cancel", { actor, target });
  if (type === "debate_ballots_recorded")
    return text(locale, "console.debate.ledger", { actor, target });
  return text(locale, "console.debate.result", {
    actor,
    target,
    eligible: p.eligibleCount as number,
    supports: p.supports as number,
    rejects: p.rejects as number,
    abstentions: p.abstentions as number,
    result: text(locale, p.success ? "common.yes" : "common.no"),
    blocked: p.blockedId as number,
  });
}
export function toolFailure(locale: Locale, error: string, originalMessage?: string) {
  return { ok: false as const, error, message: originalMessage ?? errorMessage(locale, error) };
}

export function renderMessage(locale: Locale, message: MessageRef): string {
  return text(locale, message.key, message.parameters);
}

export const AUDIT_SECTIONS = [
  "session",
  "stats",
  "findings",
  "observations",
  "todo",
  "conclusion",
  "pipeline",
] as const;
export type AuditSection = (typeof AUDIT_SECTIONS)[number];
export function auditHeadings(locale: Locale): Record<AuditSection, string> {
  return Object.fromEntries(
    AUDIT_SECTIONS.map((section) => [
      section,
      text(locale, `audit.heading.${section}` as MessageKey),
    ]),
  ) as Record<AuditSection, string>;
}

export function victoryClaimLabel(claim: VictoryClaim, locale: Locale = "zh-CN"): string {
  if (claim.kind === "faction")
    return text(locale, "victory.faction", { faction: term("camp_team", claim.faction, locale) });
  if (claim.kind === "individual")
    return text(locale, "victory.individual", {
      player: text(locale, "replay.player", { id: claim.playerId }),
      goal:
        claim.goalId === "netease_cursed_fox_last_faction_v1"
          ? text(locale, "victory.goal.netease_cursed_fox_last_faction_v1")
          : claim.goalId,
    });
  return text(locale, "victory.relationship", {
    group:
      claim.groupId === "cupid_lovers" ? text(locale, "victory.group.cupid_lovers") : claim.groupId,
  });
}
export function outcomeLabel(outcome: GameOutcome, locale: Locale = "zh-CN"): string {
  if (outcome.kind === "no_winner") return text(locale, "replay.no_winner");
  const primary = victoryClaimLabel(outcome.primary, locale);
  return outcome.additional.length
    ? text(locale, "victory.additional", {
        primary,
        additional: outcome.additional
          .map((claim) => victoryClaimLabel(claim, locale))
          .join(locale === "zh-CN" ? "；" : "; "),
      })
    : primary;
}
export function outcomeWinnersLabel(outcome: GameOutcome, locale: Locale = "zh-CN"): string {
  const players =
    outcome.kind === "victory"
      ? outcome.winningPlayerIds
          .map((id) => text(locale, "replay.player", { id }))
          .join(locale === "zh-CN" ? "、" : ", ")
      : "";
  return text(locale, "victory.winners", { players: players || text(locale, "common.none") });
}
export function victoryPointLabel(point: VictoryPoint, locale: Locale = "zh-CN"): string {
  return text(locale, "victory.point", {
    day: point.day,
    phase: term("phase", point.phase, locale),
    checkpoint: text(locale, `checkpoint.${point.checkpoint}`),
  });
}

/** Private learning/choice facts never imply deaths or change true God seat identities. */
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

/** Wire-facing labels shared by console and replay; choices never imply a player has died. */
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

/** Merchant choices and God outcomes label facts without prematurely marking death or changing identity. */
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

/** Shared private gift status text. Invalid/non-JSON descriptors never execute during rendering. */
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

export function wallEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  const p = readWallEventFact(type, payload);
  if (!p) return null;
  if (type === "wall_notes_started") return text(locale, "console.wall.start");
  if (type === "wall_notes_canceled") return text(locale, "console.wall.cancel");
  if (type === "wall_notes_published")
    return text(locale, "console.wall.publish", { notes: JSON.stringify(p.texts) });
  if (type === "wall_note_order_recorded")
    return text(locale, "console.wall.order", { rows: JSON.stringify(p.rows) });
  return text(locale, "console.wall.item", {
    actor: p.actorId,
    operation: text(locale, `item.operation.${p.operation}` as MessageKey),
    remaining: p.remaining,
    expired: String(p.expired),
    body: p.text ?? "",
  });
}

export function thiefEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  const p = readThiefEventFact(type, payload);
  if (!p) return null;
  if (type === "thief_initial_deal")
    return text(locale, "console.thief.deal", {
      roles: JSON.stringify((p.roles as RoleId[]).map((role) => roleName(role, locale))),
      size: p.boardSize as number,
    });
  if (p.slot === null) return text(locale, "console.thief.keep", { actor: p.actorId as number });
  return text(locale, "console.thief.choice", {
    actor: p.actorId as number,
    slot: p.slot as number,
    role: roleName(p.role as RoleId, locale),
    camp: term("camp_team", p.camp as "good" | "wolf", locale),
  });
}

export function wildChildEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  const p = readWildChildEventFact(type, payload) ?? readWildChildPlayerFact(type, payload);
  if (!p) return null;
  if (type === "wild_child_model_chosen")
    return text(locale, "console.wild_child.choice", {
      actor: p.actorId as number,
      target: p.targetId as number,
    });
  if (type === "wild_child_model_eliminated")
    return text(locale, "console.wild_child.death", {
      actor: p.actorId as number,
      target: p.targetId as number,
      causes: JSON.stringify(p.sources),
      commit: p.deathCommit as string,
    });
  if (type === "wild_child_transformed")
    return text(locale, "console.wild_child.transform", {
      actor: p.actorId as number,
      night: p.eligibleNight as number,
    });
  return text(locale, "console.wild_child.active", {
    actor: p.actorId as number,
    night: p.day as number,
  });
}

export function shapeshifterEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const p = readShapeshifterEventFact(type, payload);
  if (!p) return null;
  if (type === "shapeshifter_initial_deal")
    return text(locale, "console.shapeshifter.deal", {
      roles: JSON.stringify((p.roles as RoleId[]).map((role) => roleName(role, locale))),
      size: p.boardSize as number,
    });
  return text(locale, "console.shapeshifter.choice", {
    actor: p.actorId as number,
    slot: p.slot as number,
    role: roleName(p.role as RoleId, locale),
    camp: term("camp_team", p.camp as "good" | "wolf", locale),
  });
}

export * from "./lonely-girl";
import { readLonelyGirlEventFact } from "./lonely-girl";
export function lonelyGirlEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const p = readLonelyGirlEventFact(type, payload);
  return p
    ? text(locale, p.camp ? "console.lonely_girl.god" : "console.lonely_girl.choice", {
        actor: p.actorId,
        target: p.targetId,
        ...(p.camp ? { camp: term("camp", p.camp, locale) } : {}),
      })
    : null;
}

export * from "./ghost-bride";

import { readGhostBrideEventFact } from "./ghost-bride";
export function ghostBrideEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const p = readGhostBrideEventFact(type, payload);
  if (!p) return null;
  const none = text(locale, "replay.none");
  const parameters: Record<string, string | number> = {
    bride: Number(p.brideId ?? 0),
    groom: Number(p.groomId ?? 0),
    witness: Number(p.witnessId ?? 0),
    actor: Number(p.actorId ?? 0),
    recipient: Number(p.recipientId ?? 0),
    target: p.targetId === null ? none : Number(p.targetId ?? 0),
    vote: Number(p.voteIndex ?? 0),
    day: Number(p.day),
    body: String(p.text ?? ""),
    owner: p.owner ? text(locale, `wedding.owner.${p.owner}` as MessageKey) : none,
    actors: Array.isArray(p.actorIds) ? p.actorIds.join(", ") : none,
  };
  const names: Record<string, string[]> = {
    ghost_bride_pair_chosen: ["bride", "groom"],
    ghost_bride_group_chosen: ["bride", "groom", "witness"],
    ghost_bride_witness_vote: ["actor", "vote", "target"],
    ghost_bride_partner_chat: ["actor", "recipient", "body"],
    ghost_bride_knife_captured: ["day", "owner", "actors"],
    ghost_bride_knife_vote: ["actor", "target"],
    ghost_bride_knife_resolved: ["day", "target"],
    ghost_bride_partner_death: ["actor", "target"],
  };
  return text(
    locale,
    `console.${type}` as MessageKey,
    Object.fromEntries(names[type]!.map((name) => [name, parameters[name]!])),
  );
}

export * from "./demon-hunter";
import { readDemonHunterEventFact, readDemonHunterPlayerFact } from "./demon-hunter";
export function demonHunterEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const full = readDemonHunterEventFact(type, payload),
    own = readDemonHunterPlayerFact(type, payload);
  if (!full && !own) return null;
  if (type === "demon_hunter_chosen") {
    const p = (full ?? own)! as { day: number; targetId: number | null; actorId?: number };
    return text(locale, full ? "console.demon_hunter.chosen" : "console.demon_hunter.own", {
      day: p.day,
      target: p.targetId === null ? text(locale, "replay.none") : p.targetId,
      ...(full ? { actor: p.actorId! } : {}),
    });
  }
  if (type === "demon_hunter_cancelled") {
    const p = full as import("./demon-hunter").DemonHunterCancelFact;
    return text(locale, "console.demon_hunter.cancelled", {
      actor: p.actorId,
      day: p.day,
      target: p.targetId,
      fault: p.faultId ?? text(locale, "replay.none"),
    });
  }
  const p = full as import("./demon-hunter").DemonHunterPoisonImmuneFact;
  return text(locale, "console.demon_hunter.poison_immune", {
    actor: p.actorId,
    day: p.day,
    witch: p.witchId,
  });
}

export { PURE_WHITE_POLICY } from "@ai-werewolf-arena/game-contract";
export { EVIL_KNIGHT_POLICY } from "@ai-werewolf-arena/game-contract";

export { NIGHTMARE_SHADOW_POLICY } from "@ai-werewolf-arena/game-contract";

export * from "./nightmare";
import { readNightmareFearFact, readNightmareOwnFearFact } from "./nightmare";
export function nightmareEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const full = readNightmareFearFact(type, payload);
  const own = readNightmareOwnFearFact(type, payload);
  const fact = full ?? own;
  if (!fact) return null;
  const target = fact.targetId ?? text(locale, "console.nightmare.pass");
  return full
    ? text(locale, "console.nightmare.fear", { actor: full.actorId, day: full.day, target })
    : text(locale, "console.nightmare.own", { day: fact.day, target });
}

export * from "./red-moon";

export function redMoonEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const next = readRedMoonNextNightFact(type, payload);
  if (next)
    return text(
      locale,
      type === "red_moon_night_sealed" ? "console.red_moon.seal" : "console.red_moon.exile",
      {
        actor: next.actorId,
        night: next.night,
      },
    );
  const expiry = readRedMoonExpiryFact(type, payload);
  return expiry
    ? text(locale, "console.red_moon.expiry", { actor: expiry.actorId, day: expiry.day })
    : null;
}

export * from "./magician";

import {
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
  readDeathShotMissFact,
} from "./magician";
export function magicianEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const miss = readDeathShotMissFact(type, payload);
  if (miss) return text(locale, "console.shot.missed", { actor: miss.actorId });
  const full = readMagicianExchangeFact(type, payload),
    own = readMagicianOwnExchangeFact(type, payload),
    fact = full ?? own;
  if (!fact) return null;
  const pair = fact.pair ? fact.pair.join(", ") : text(locale, "console.magician.pass");
  return full
    ? text(locale, "console.magician.exchange", { actor: full.actorId, day: full.day, pair })
    : text(locale, "console.magician.own", { day: fact.day, pair });
}

export * from "./order-prince";

import { readOrderPrinceRevoteFact } from "./order-prince";
export function orderPrinceEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "order_prince_choice_committed") {
    const fact = readOrderPrinceChoiceFact(type, payload);
    return fact
      ? text(locale, "event.order_prince_choice_committed", {
          day: fact.day,
          choice: text(
            locale,
            fact.activate ? "console.order_prince.activate" : "console.order_prince.decline",
          ),
        })
      : text(locale, "replay.unknown");
  }
  if (type !== "order_prince_revote_started") return null;
  const fact = readOrderPrinceRevoteFact(type, payload);
  return fact
    ? text(locale, "event.order_prince_revote_started", { actor: fact.actorId })
    : text(locale, "replay.unknown");
}

export * from "./trickster";
export function tricksterEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "trickster_exchange_committed") {
    const f = readTricksterExchangeFact(type, payload);
    return f
      ? text(locale, "event.trickster_exchange_committed", {
          actor: f.actorId,
          day: f.day,
          pair: f.pair ? f.pair.join(", ") : text(locale, "console.magician.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "trickster_exchange_skipped") {
    const f = readTricksterSkipFact(type, payload);
    return f
      ? text(
          locale,
          f.reason === "dead"
            ? "event.trickster_skipped_dead"
            : "event.trickster_skipped_exhausted",
          { actor: f.actorId, day: f.day },
        )
      : text(locale, "replay.unknown");
  }
  if (type === "exile_target_mapped") {
    const f = readExileMappingFact(type, payload);
    return f
      ? text(locale, f.missed ? "event.exile_mapping_missed" : "event.exile_target_mapped", {
          requested: f.requestedId,
          effective: f.effectiveId,
        })
      : text(locale, "replay.unknown");
  }
  return null;
}

export * from "./wolf-sorcerer";
export function wolfSorcererEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "wolf_sorcerer_exchange_committed") {
    const f = readWolfSorcererExchangeFact(type, payload);
    return f
      ? text(locale, "event.wolf_sorcerer_exchange_committed", {
          actor: f.actorId,
          day: f.day,
          pair: f.pair ? f.pair.join(", ") : text(locale, "console.magician.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "wolf_sorcerer_exchange_skipped") {
    const f = readWolfSorcererSkipFact(type, payload);
    return f
      ? text(
          locale,
          f.reason === "dead"
            ? "event.wolf_sorcerer_skipped_dead"
            : f.reason === "not_started"
              ? "event.wolf_sorcerer_skipped_not_started"
              : "event.wolf_sorcerer_skipped_exhausted",
          { actor: f.actorId, day: f.day },
        )
      : text(locale, "replay.unknown");
  }
  return null;
}

export * from "./time-consort";

export function timeConsortEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "time_consort_lock_committed") {
    const f = readTimeConsortChoiceFact(type, payload);
    return f
      ? text(locale, "event.time_consort_lock_committed", {
          actor: f.actorId,
          day: f.day,
          target: f.targetId ?? text(locale, "console.magician.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "time_consort_lock_skipped") {
    const f = readTimeConsortSkipFact(type, payload);
    return f
      ? text(
          locale,
          f.reason === "dead"
            ? "event.time_consort_skipped_dead"
            : "event.time_consort_skipped_exhausted",
          { actor: f.actorId, day: f.day },
        )
      : text(locale, "replay.unknown");
  }
  if (type === "time_consort_reflected") {
    const f = readTimeConsortReflectionFact(type, payload);
    return f
      ? text(locale, "event.time_consort_reflected", {
          actor: f.actorId,
          day: f.day,
          source: f.sourceId,
          target: f.requestedId,
          effective: f.effectiveId,
          skill: text(
            locale,
            f.kind === "check"
              ? "time_consort.skill.check"
              : f.kind === "guard"
                ? "time_consort.skill.guard"
                : "time_consort.skill.poison",
          ),
        })
      : text(locale, "replay.unknown");
  }
  return null;
}

export function scholarMentorEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  if (type === "modifier_choice_committed") {
    const f = readModifierChoiceFact(type, payload);
    return f
      ? text(locale, "event.modifier_choice", {
          actor: f.actorId,
          day: f.day,
          mode:
            f.mode === null
              ? text(locale, "modifier.pass")
              : text(locale, f.mode === "enhance" ? "modifier.enhance" : "modifier.weaken"),
          target: f.targetId ?? text(locale, "modifier.pass"),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "modifier_choice_skipped") {
    const f = readModifierSkipFact(type, payload);
    return f
      ? text(locale, "event.modifier_skip", {
          actor: f.actorId,
          day: f.day,
          reason: text(
            locale,
            f.reason === "first_night"
              ? "modifier.first_night"
              : f.reason === "dead"
                ? "modifier.dead"
                : "modifier.exhausted",
          ),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "modifier_conflict_resolved") {
    const f = readModifierConflictFact(type, payload);
    return f
      ? text(locale, "event.modifier_conflict", {
          day: f.day,
          target: f.targetId,
          kind: text(
            locale,
            f.kind === "same_good" ? "modifier.same_good" : "modifier.both_wolves",
          ),
        })
      : text(locale, "replay.unknown");
  }
  if (type === "modifier_bonus_resolved") {
    const f = readModifierBonusFact(type, payload);
    if (!f) return text(locale, "replay.unknown");
    const skill = text(
      locale,
      f.kind === "check"
        ? "modifier.check"
        : f.kind === "guard"
          ? "modifier.guard"
          : f.kind === "poison"
            ? "modifier.poison"
            : "modifier.kill",
    );
    return (
      text(locale, "event.modifier_bonus", {
        actor: f.actorId,
        day: f.day,
        skill,
        target: f.targetId ?? text(locale, "modifier.pass"),
      }) +
      (f.kind === "check" && !f.abstain
        ? text(locale, f.isWerewolf ? "modifier.result_wolf" : "modifier.result_good")
        : "")
    );
  }
  return null;
}

export * from "./scholar-mentor";

export * from "./mist-raven";
export function mistRavenEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readMistRavenFact(type, payload);
  if (!fact) return null;
  const key = `event.${type}` as MessageKey;
  if ("candidates" in fact)
    return text(locale, key, {
      day: fact.day,
      candidates: fact.candidates.join(", ") || text(locale, "common.none"),
      target: fact.targetId ?? text(locale, "common.none"),
    });
  const common = { day: fact.day, actor: fact.actorId };
  if ("targetIds" in fact)
    return text(locale, key, {
      ...common,
      targets: fact.targetIds?.join(", ") ?? text(locale, "common.none"),
    });
  if ("knownTeammateIds" in fact)
    return text(locale, key, {
      ...common,
      teammates: fact.knownTeammateIds.join(", ") || text(locale, "common.none"),
    });
  if ("reason" in fact)
    return text(locale, key, {
      ...common,
      reason: text(locale, `mist.reason.${fact.reason}`),
    });
  return text(locale, key, { ...common, target: fact.targetId ?? text(locale, "common.none") });
}

export * from "./radiant-eclipse";
export function radiantEclipseEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readRadiantEclipseFact(type, payload);
  if (!fact) return null;
  if ("playerId" in fact) return text(locale, `event.${type}` as MessageKey);
  if ("status" in fact)
    return text(
      locale,
      fact.status === "committed" ? "event.eclipse_lease_committed" : "event.eclipse_lease_aborted",
      { day: fact.day },
    );
  return text(
    locale,
    type === "eclipse_swallowed"
      ? fact.targetId === null
        ? "event.eclipse_swallow_passed"
        : "event.eclipse_swallowed"
      : fact.targetId === null
        ? "event.radiant_shelter_passed"
        : "event.radiant_shelter_used",
    fact.targetId === null
      ? { actor: fact.actorId }
      : { actor: fact.actorId, target: fact.targetId },
  );
}

export * from "./noble-secret-body";

export function nobleSecretBodyEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readNobleSecretBodyFact(type, payload);
  if (!f) return null;
  const key = `event.${type}` as MessageKey;
  if (type === "noble_body_native_damage_committed") return text(locale, key, { day: f.day });
  if (type === "noble_body_knife_committed" && "targetId" in f)
    return text(locale, key, { day: f.day, target: f.targetId ?? text(locale, "common.none") });
  if ("notifiedActorIds" in f) return text(locale, key, { day: f.day });
  if ("deathSources" in f)
    return text(locale, key, { day: f.day, state: JSON.stringify(f.deathSources) });
  if ("causes" in f)
    return text(locale, key, { actor: f.actorId, day: f.day, causes: f.causes.join(", ") });

  if (type === "secret_body_revealed") return text(locale, key, { actor: f.actorId });
  if ("text" in f) return text(locale, key, { actor: f.actorId, text: f.text });
  if ("resource" in f)
    return text(locale, key, { actor: f.actorId, day: f.day, resource: f.resource });
  if ("contracts" in f)
    return text(locale, key, { actor: f.actorId, day: f.day, state: JSON.stringify(f.contracts) });
  if ("status" in f)
    return text(locale, key, {
      day: f.day,
      contract: f.contractId,
      target: f.targetId,
      status: f.status,
    });
  if ("cause" in f)
    return text(locale, key, { actor: f.actorId, day: f.day, target: f.targetId, cause: f.cause });
  return text(locale, key, {
    actor: f.actorId,
    day: f.day,
    target: ("targetId" in f ? f.targetId : null) ?? text(locale, "common.none"),
  });
}

export * from "./fragrant-pair-seer";

export function fragrantPairEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const f = readFragrantPairFact(type, payload);
  if (!f) return null;
  const base = { actor: f.actorId, day: f.day };
  if ("knowledgeDrawCount" in f) return text(locale, "event.fragrant_night_opened", { day: f.day });
  if ("deaths" in f)
    return text(locale, "event.fragrant_wave_committed", {
      actor: f.actorId,
      day: f.day,
      deaths: f.deaths.join(", "),
    });
  if ("known" in f)
    return text(locale, "event.fragrant_night_notified", {
      ...base,
      state: JSON.stringify(f.known),
    });
  if ("containsWerewolf" in f)
    return text(locale, "event.fragrant_pair_inspected", {
      ...base,
      first: f.targetIds[0],
      second: f.targetIds[1],
      result: text(locale, f.containsWerewolf ? "fragrant.result.true" : "fragrant.result.false"),
    });
  if ("rootId" in f)
    return text(locale, "event.fragrant_link_triggered", {
      ...base,
      first: f.pairIds[0],
      second: f.pairIds[1],
      root: f.rootId,
      added: f.addedTargetId ?? text(locale, "fragrant.trigger.no_addition"),
    });
  if ("createdNight" in f)
    return text(locale, "event.fragrant_binding_expired", {
      ...base,
      created: f.createdNight,
      first: f.pairIds[0],
      second: f.pairIds[1],
    });
  return text(locale, "event.fragrant_pair_chosen", {
    ...base,
    targets: f.pairIds?.join(", ") ?? text(locale, "fragrant.choice.pass"),
  });
}

export {
  ANIMAL_DREAM_POLICY,
  CAT_SKIPPED_VOTE_POLICIES,
  PUFFER_BALLOT_POLICIES,
  BEAR_SIGNAL_POLICIES,
} from "@ai-werewolf-arena/game-contract";
export type {
  CatSkippedVotePolicy,
  PufferBallotPolicy,
  BearSignalPolicy,
} from "@ai-werewolf-arena/game-contract";

/** Shared labels validate the complete finite fact before reading any field. */
export function animalDreamEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readAnimalDreamFact(type, payload);
  if (!fact) return null;
  const p = fact.payload;
  if (fact.type === "animal_night_opened")
    return text(locale, "event.animal_night_opened", { day: p.day });
  if (fact.type === "animal_cat_revealed" || fact.type === "animal_puffer_revealed")
    return text(locale, `event.${fact.type}`, { actor: "actorId" in p ? p.actorId : "" });
  return text(locale, `event.${fact.type}`, {
    day: p.day,
    ...("actorId" in p &&
    [
      "animal_fox_chosen",
      "animal_knife_notified",
      "animal_beauty_notified",
      "animal_puffer_decided",
      "animal_cat_expiry_prepared",
    ].includes(fact.type)
      ? { actor: p.actorId }
      : {}),
    state: JSON.stringify(p),
  });
}
