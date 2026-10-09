import { readWildChildEventFact, readWildChildPlayerFact } from "./wild-child";
export {
  readWildChildEventFact,
  readWildChildPlayerFact,
  WILD_CHILD_EVENT_TYPES,
} from "./wild-child";
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
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
  isRoleId,
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
import { zhCN, type MessageKey } from "./zh-CN";
import { en } from "./en";

export type { Locale, MessageKey };
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return unknown();
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const allowed =
    type === "hybrid_exemplar_chosen"
      ? ["actorId", "day", "targetId"]
      : ["actorId", "day", "targetId", "faction"];
  if (
    Object.keys(p).some((key) => !allowed.includes(key)) ||
    !positive(p.actorId) ||
    p.day !== 1 ||
    !positive(p.targetId) ||
    p.actorId === p.targetId
  )
    return unknown();
  const parameters = { actor: p.actorId, day: p.day, target: p.targetId };
  if (type === "hybrid_exemplar_chosen") return text(locale, "console.hybrid.choice", parameters);
  return p.faction === "good" || p.faction === "wolf"
    ? text(locale, "console.hybrid.affiliation", {
        ...parameters,
        faction: term("camp", p.faction, locale),
      })
    : unknown();
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

export interface MessageRef {
  key: MessageKey;
  parameters?: Readonly<Record<string, string | number>>;
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

export const MECHANICAL_EVENT_TYPES = [
  "mechanical_awakened",
  "mechanical_mode_selected",
  "mechanical_mimicked",
  "mechanical_mimic_skipped",
  "mechanical_skill_skipped",
  "mechanical_poison_used",
  "mechanical_guard_chosen",
  "mechanical_attack_chosen",
  "mechanical_poison_reflected",
  "mechanical_shot",
] as const;

export const AWAKENED_EVENT_TYPES = [
  "awakened_inherited",
  "awakened_mimicked",
  "awakened_mimic_skipped",
  "awakened_ready",
  "awakened_skill_skipped",
  "awakened_poison_used",
  "awakened_guard_chosen",
  "awakened_attack_chosen",
] as const;
/** Private learning/choice facts never imply deaths or change true God seat identities. */
export function awakenedEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(AWAKENED_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const unknown = () => text(locale, "replay.unknown");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return unknown();
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const actor = p.actorId,
    day = p.day,
    target = p.targetId;
  if (!positive(actor) || (type !== "awakened_ready" && !positive(day))) return unknown();
  switch (type) {
    case "awakened_inherited":
      return positive(p.firstKnifeNight)
        ? text(locale, "console.awakened.inherited", { actor, day, first: p.firstKnifeNight })
        : unknown();
    case "awakened_mimicked":
      return positive(target) && target !== actor && isRoleId(p.role)
        ? text(locale, "console.awakened.mimic", {
            actor,
            day,
            target,
            role: roleName(p.role, locale),
          })
        : unknown();
    case "awakened_ready":
      return positive(p.activationNight) &&
        positive(p.activeFromNight) &&
        p.activeFromNight === p.activationNight + 1 &&
        isRoleId(p.role)
        ? text(locale, "console.awakened.ready", {
            actor,
            activation: p.activationNight,
            ready: p.activeFromNight,
            role: roleName(p.role, locale),
          })
        : unknown();
    case "awakened_mimic_skipped":
      return text(locale, "console.awakened.mimic_skip", { actor, day });
    case "awakened_skill_skipped":
      return text(locale, "console.awakened.skill_skip", { actor, day });
    case "awakened_poison_used":
      return positive(target)
        ? text(locale, "console.awakened.poison", { actor, day, target })
        : unknown();
    case "awakened_guard_chosen":
    case "awakened_attack_chosen":
      return target === null || positive(target)
        ? text(
            locale,
            type === "awakened_guard_chosen" ? "console.awakened.guard" : "console.awakened.attack",
            { actor, day, target: target ?? text(locale, "common.none") },
          )
        : unknown();
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null) return unknown();
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return unknown();
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([name, field]) => [name, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const actor = p.actorId,
    day = p.day,
    target = p.targetId;
  if (!positive(actor) || (type !== "mechanical_shot" && !positive(day))) return unknown();
  switch (type) {
    case "mechanical_awakened":
      return positive(p.firstKnifeNight)
        ? text(locale, "console.mechanical.awakened", { actor, day, first: p.firstKnifeNight })
        : unknown();
    case "mechanical_mode_selected":
      return p.mode === "kill" || p.mode === "skill"
        ? text(locale, "console.mechanical.mode", {
            actor,
            day,
            mode: text(
              locale,
              p.mode === "kill" ? "mechanical.mode.kill" : "mechanical.mode.skill",
            ),
          })
        : unknown();
    case "mechanical_mimicked":
      return positive(target) && isRoleId(p.role) && positive(p.readyOnNight)
        ? text(locale, "console.mechanical.mimic", {
            actor,
            day,
            target,
            role: roleName(p.role, locale),
            ready: p.readyOnNight,
          })
        : unknown();
    case "mechanical_mimic_skipped":
      return text(locale, "console.mechanical.mimic_skip", { actor, day });
    case "mechanical_skill_skipped":
      return text(locale, "console.mechanical.skill_skip", { actor, day });
    case "mechanical_poison_used":
      return positive(target)
        ? text(locale, "console.mechanical.poison", { actor, day, target })
        : unknown();
    case "mechanical_guard_chosen":
      return (target === null || positive(target)) && typeof p.failed === "boolean"
        ? text(locale, "console.mechanical.guard", {
            actor,
            day,
            target: target ?? text(locale, "common.none"),
            failed: text(locale, p.failed ? "common.yes" : "common.no"),
          })
        : unknown();
    case "mechanical_attack_chosen":
      return target === null || positive(target)
        ? text(locale, "console.mechanical.attack", {
            actor,
            day,
            target: target ?? text(locale, "common.none"),
          })
        : unknown();
    case "mechanical_poison_reflected":
      return positive(p.protectedTargetId) && positive(p.casterId)
        ? text(locale, "console.mechanical.reflection", {
            actor,
            day,
            target: p.protectedTargetId,
            caster: p.casterId,
          })
        : unknown();
    case "mechanical_shot":
      return positive(target)
        ? text(locale, "console.mechanical.shot", { actor, target })
        : unknown();
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return unknown();
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!positive(p.actorId) || !positive(p.day)) return unknown();
  const actor = p.actorId,
    day = p.day;
  if (type === "merchant_trade_skipped")
    return text(locale, "console.merchant.skip", { actor, day });
  if (!positive(p.targetId) || !["check", "poison", "guard"].includes(p.skill)) return unknown();
  const skill = text(
      locale,
      p.skill === "check"
        ? "merchant.skill.check"
        : p.skill === "poison"
          ? "merchant.skill.poison"
          : "merchant.skill.guard",
    ),
    target = p.targetId;
  if (type === "merchant_trade_committed")
    return text(locale, "console.merchant.trade", { actor, day, target, skill });
  return p.outcome === "granted" || p.outcome === "backlash"
    ? text(locale, "console.merchant.outcome", {
        actor,
        day,
        target,
        skill,
        outcome: text(
          locale,
          p.outcome === "granted" ? "merchant.outcome.granted" : "merchant.outcome.backlash",
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return unknown();
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (
    !positive(p.actorId) ||
    typeof p.abilityId !== "string" ||
    !/^[a-z][a-z0-9:_-]{0,127}$/.test(p.abilityId) ||
    p.abilityId.startsWith("native:") ||
    !positive(p.grantedNight) ||
    !(p.armedOnNight === null || (positive(p.armedOnNight) && p.armedOnNight >= p.grantedNight)) ||
    ![0, 1].includes(p.remaining) ||
    typeof p.disabled !== "boolean" ||
    typeof p.deathExpired !== "boolean" ||
    !["granted", "armed", "disabled", "enabled", "transferred_out"].includes(p.operation)
  )
    return unknown();
  if (
    (p.operation === "armed" &&
      (p.armedOnNight === null || p.disabled || p.deathExpired || p.remaining !== 1)) ||
    (p.operation === "disabled" && !p.disabled) ||
    (p.operation === "enabled" && (p.disabled || p.deathExpired)) ||
    (p.deathExpired && (!p.disabled || p.remaining !== 0))
  )
    return unknown();
  return text(locale, "ability.death_gun.change", {
    actor: p.actorId,
    id: p.abilityId,
    operation: text(locale, `ability.operation.${p.operation}` as MessageKey),
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return unknown();
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (v: unknown): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v > 0;
  if (!positive(p.actorId) || !positive(p.day)) return unknown();
  if (type === "black_market_trade_skipped")
    return text(locale, "console.black_market.skip", { actor: p.actorId, day: p.day });
  if (
    !positive(p.targetId) ||
    p.actorId === p.targetId ||
    !["check", "poison", "gun"].includes(p.skill)
  )
    return unknown();
  const args = {
    actor: p.actorId,
    day: p.day,
    target: p.targetId,
    skill: text(locale, `black_market.skill.${p.skill}` as MessageKey),
  };
  if (type === "black_market_trade_committed")
    return text(locale, "console.black_market.choice", args);
  return p.outcome === "granted" || p.outcome === "backlash"
    ? text(locale, "console.black_market.result", {
        ...args,
        outcome: text(
          locale,
          p.outcome === "granted" ? "merchant.outcome.granted" : "merchant.outcome.backlash",
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
