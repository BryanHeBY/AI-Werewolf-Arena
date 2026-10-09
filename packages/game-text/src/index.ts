import { isRoleId, isLocale, roleName as catalogRoleName, type Locale, type InspectionResult, type GameOutcome, type VictoryClaim, type VictoryPoint } from "@ai-werewolf-arena/game-catalog";
import { zhCN, type MessageKey } from "./zh-CN";
import { en } from "./en";

export type { Locale, MessageKey };
export const dictionaries = Object.freeze({ "zh-CN": zhCN, en });
const placeholderPattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
export function placeholders(template: string): string[] { return [...new Set([...template.matchAll(placeholderPattern)].map(match => match[1]))].sort(); }

/** Locale is a value on each call; there is no mutable process-wide language. */
export function text(locale: Locale, key: MessageKey, parameters: Readonly<Record<string, string | number>> = {}): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  if (!Object.hasOwn(dictionaries[locale], key)) throw new Error(`i18n_key_missing: ${key}`);
  const template = dictionaries[locale][key];
  if (template === undefined) throw new Error(`i18n_key_missing: ${key}`);
  const expected = placeholders(template);
  for (const name of expected) {
    if (!Object.hasOwn(parameters, name)) throw new Error(`i18n_parameter_missing: ${key}.${name}`);
    const value = parameters[name];
    if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`i18n_parameter_invalid: ${key}.${name}`);
  }
  for (const name of Object.keys(parameters)) if (!expected.includes(name)) throw new Error(`i18n_parameter_unused: ${key}.${name}`);
  return template.replace(placeholderPattern, (_match, name: string) => String(parameters[name]));
}

export function roleName(id: string, locale: Locale = "zh-CN"): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  return catalogRoleName(id, locale);
}
export function term(kind: "camp" | "camp_team" | "phase" | "stage" | "potion" | "reason" | "rule" | "tie", id: string, locale: Locale = "zh-CN"): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  const key = `${kind}.${id}` as MessageKey;
  return Object.hasOwn(zhCN, key) ? text(locale, key) : id;
}

export function inspectionLabel(result: InspectionResult, locale: Locale = "zh-CN"): string {
  if (result.kind === "camp") return term("camp", result.camp, locale);
  if (result.kind === "role") return roleName(result.role, locale);
  return text(locale, "inspection.combined", { role: roleName(result.role, locale), camp: term("camp", result.camp, locale) });
}

export function validateDictionaries(): void {
  const expected = Object.keys(zhCN).sort();
  for (const [locale, dictionary] of Object.entries(dictionaries)) {
    if (JSON.stringify(Object.keys(dictionary).sort()) !== JSON.stringify(expected)) throw new Error(`i18n_key_set_mismatch: ${locale}`);
    for (const key of expected as MessageKey[]) {
      if (!dictionary[key].trim()) throw new Error(`i18n_text_empty: ${locale}.${key}`);
      if (JSON.stringify(placeholders(dictionary[key])) !== JSON.stringify(placeholders(zhCN[key]))) throw new Error(`i18n_placeholder_mismatch: ${locale}.${key}`);
    }
  }
}

/** Machine error IDs stay stable; render only their human explanation. */
export function errorMessage(locale: Locale, code: string): string {
  const key = `error.${code}` as MessageKey;
  return Object.hasOwn(zhCN, key) ? text(locale, key) : text(locale, "tool.unknown_error", { code });
}

/** God labels describe membership separately from physical role/camp and never imply death. */
export function hybridEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (type !== "hybrid_exemplar_chosen" && type !== "hybrid_affiliation_resolved") return null;
  const unknown = () => text(locale, "replay.unknown");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload), descriptors = Object.getOwnPropertyDescriptors(payload);
  if ((prototype !== Object.prototype && prototype !== null) || Object.values(descriptors).some(field => !Object.hasOwn(field, "value") || !field.enumerable)) return unknown();
  const p = Object.fromEntries(Object.entries(descriptors).map(([key, field]) => [key, field.value]));
  const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const allowed = type === "hybrid_exemplar_chosen" ? ["actorId", "day", "targetId"] : ["actorId", "day", "targetId", "faction"];
  if (Object.keys(p).some(key => !allowed.includes(key)) || !positive(p.actorId) || p.day !== 1 || !positive(p.targetId) || p.actorId === p.targetId) return unknown();
  const parameters = { actor: p.actorId, day: p.day, target: p.targetId };
  if (type === "hybrid_exemplar_chosen") return text(locale, "console.hybrid.choice", parameters);
  return p.faction === "good" || p.faction === "wolf" ? text(locale, "console.hybrid.affiliation", { ...parameters, faction: term("camp", p.faction, locale) }) : unknown();
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

export const AUDIT_SECTIONS = ["session", "stats", "findings", "observations", "todo", "conclusion", "pipeline"] as const;
export type AuditSection = typeof AUDIT_SECTIONS[number];
export function auditHeadings(locale: Locale): Record<AuditSection, string> {
  return Object.fromEntries(AUDIT_SECTIONS.map(section => [section, text(locale, `audit.heading.${section}` as MessageKey)])) as Record<AuditSection, string>;
}

export function victoryClaimLabel(claim: VictoryClaim, locale: Locale = "zh-CN"): string {
  if (claim.kind === "faction") return text(locale, "victory.faction", { faction: term("camp_team", claim.faction, locale) });
  if (claim.kind === "individual") return text(locale, "victory.individual", { player: text(locale, "replay.player", { id: claim.playerId }), goal: claim.goalId });
  return text(locale, "victory.relationship", { group: claim.groupId });
}
export function outcomeLabel(outcome: GameOutcome, locale: Locale = "zh-CN"): string {
  if (outcome.kind === "no_winner") return text(locale, "replay.no_winner");
  const primary = victoryClaimLabel(outcome.primary, locale);
  return outcome.additional.length ? text(locale, "victory.additional", { primary, additional: outcome.additional.map(claim => victoryClaimLabel(claim, locale)).join(locale === "zh-CN" ? "；" : "; ") }) : primary;
}
export function outcomeWinnersLabel(outcome: GameOutcome, locale: Locale = "zh-CN"): string {
  const players = outcome.kind === "victory" ? outcome.winningPlayerIds.map(id => text(locale, "replay.player", { id })).join(locale === "zh-CN" ? "、" : ", ") : "";
  return text(locale, "victory.winners", { players: players || text(locale, "common.none") });
}
export function victoryPointLabel(point: VictoryPoint, locale: Locale = "zh-CN"): string {
  return text(locale, "victory.point", { day: point.day, phase: term("phase", point.phase, locale), checkpoint: text(locale, `checkpoint.${point.checkpoint}`) });
}

export const MECHANICAL_EVENT_TYPES = [
  "mechanical_awakened", "mechanical_mode_selected", "mechanical_mimicked", "mechanical_mimic_skipped",
  "mechanical_skill_skipped", "mechanical_poison_used", "mechanical_guard_chosen", "mechanical_attack_chosen",
  "mechanical_poison_reflected", "mechanical_shot",
] as const;

export const AWAKENED_EVENT_TYPES = ["awakened_inherited", "awakened_mimicked", "awakened_mimic_skipped", "awakened_ready", "awakened_skill_skipped", "awakened_poison_used", "awakened_guard_chosen", "awakened_attack_chosen"] as const;
/** Private learning/choice facts never imply deaths or change true God seat identities. */
export function awakenedEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(AWAKENED_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const unknown = () => text(locale, "replay.unknown");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload), descriptors = Object.getOwnPropertyDescriptors(payload);
  if ((prototype !== Object.prototype && prototype !== null) || Object.values(descriptors).some(field => !Object.hasOwn(field, "value") || !field.enumerable)) return unknown();
  const p = Object.fromEntries(Object.entries(descriptors).map(([key, field]) => [key, field.value]));
  const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const actor = p.actorId, day = p.day, target = p.targetId;
  if (!positive(actor) || (type !== "awakened_ready" && !positive(day))) return unknown();
  switch (type) {
    case "awakened_inherited": return positive(p.firstKnifeNight) ? text(locale, "console.awakened.inherited", { actor, day, first: p.firstKnifeNight }) : unknown();
    case "awakened_mimicked": return positive(target) && target !== actor && isRoleId(p.role) ? text(locale, "console.awakened.mimic", { actor, day, target, role: roleName(p.role, locale) }) : unknown();
    case "awakened_ready": return positive(p.activationNight) && positive(p.activeFromNight) && p.activeFromNight === p.activationNight + 1 && isRoleId(p.role) ? text(locale, "console.awakened.ready", { actor, activation: p.activationNight, ready: p.activeFromNight, role: roleName(p.role, locale) }) : unknown();
    case "awakened_mimic_skipped": return text(locale, "console.awakened.mimic_skip", { actor, day });
    case "awakened_skill_skipped": return text(locale, "console.awakened.skill_skip", { actor, day });
    case "awakened_poison_used": return positive(target) ? text(locale, "console.awakened.poison", { actor, day, target }) : unknown();
    case "awakened_guard_chosen": case "awakened_attack_chosen": return target === null || positive(target) ? text(locale, type === "awakened_guard_chosen" ? "console.awakened.guard" : "console.awakened.attack", { actor, day, target: target ?? text(locale, "common.none") }) : unknown();
  }
  return unknown();
}

/** Wire-facing labels shared by console and replay; choices never imply a player has died. */
export function mechanicalEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(MECHANICAL_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const unknown = () => text(locale, "replay.unknown");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null) return unknown();
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  if (Object.values(descriptors).some(field => !Object.hasOwn(field, "value") || !field.enumerable)) return unknown();
  const p = Object.fromEntries(Object.entries(descriptors).map(([name, field]) => [name, field.value]));
  const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const actor = p.actorId, day = p.day, target = p.targetId;
  if (!positive(actor) || (type !== "mechanical_shot" && !positive(day))) return unknown();
  switch (type) {
    case "mechanical_awakened": return positive(p.firstKnifeNight) ? text(locale, "console.mechanical.awakened", { actor, day, first: p.firstKnifeNight }) : unknown();
    case "mechanical_mode_selected": return p.mode === "kill" || p.mode === "skill" ? text(locale, "console.mechanical.mode", { actor, day, mode: text(locale, p.mode === "kill" ? "mechanical.mode.kill" : "mechanical.mode.skill") }) : unknown();
    case "mechanical_mimicked": return positive(target) && isRoleId(p.role) && positive(p.readyOnNight) ? text(locale, "console.mechanical.mimic", { actor, day, target, role: roleName(p.role, locale), ready: p.readyOnNight }) : unknown();
    case "mechanical_mimic_skipped": return text(locale, "console.mechanical.mimic_skip", { actor, day });
    case "mechanical_skill_skipped": return text(locale, "console.mechanical.skill_skip", { actor, day });
    case "mechanical_poison_used": return positive(target) ? text(locale, "console.mechanical.poison", { actor, day, target }) : unknown();
    case "mechanical_guard_chosen": return (target === null || positive(target)) && typeof p.failed === "boolean" ? text(locale, "console.mechanical.guard", { actor, day, target: target ?? text(locale, "common.none"), failed: text(locale, p.failed ? "common.yes" : "common.no") }) : unknown();
    case "mechanical_attack_chosen": return target === null || positive(target) ? text(locale, "console.mechanical.attack", { actor, day, target: target ?? text(locale, "common.none") }) : unknown();
    case "mechanical_poison_reflected": return positive(p.protectedTargetId) && positive(p.casterId) ? text(locale, "console.mechanical.reflection", { actor, day, target: p.protectedTargetId, caster: p.casterId }) : unknown();
    case "mechanical_shot": return positive(target) ? text(locale, "console.mechanical.shot", { actor, target }) : unknown();
    default: return unknown();
  }
}

/** Merchant choices and God outcomes label facts without prematurely marking death or changing identity. */
export function merchantEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!["merchant_trade_committed", "merchant_trade_skipped", "merchant_trade_resolved"].includes(type)) return null;
  const unknown = () => text(locale, "replay.unknown");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return unknown();
  const prototype = Object.getPrototypeOf(payload), descriptors = Object.getOwnPropertyDescriptors(payload);
  if ((prototype !== Object.prototype && prototype !== null) || Object.values(descriptors).some(field => !Object.hasOwn(field,"value") || !field.enumerable)) return unknown();
  const p = Object.fromEntries(Object.entries(descriptors).map(([key,field])=>[key,field.value]));
  const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!positive(p.actorId) || !positive(p.day)) return unknown();
  const actor=p.actorId, day=p.day;
  if (type === "merchant_trade_skipped") return text(locale,"console.merchant.skip",{actor,day});
  if (!positive(p.targetId) || !["check","poison","guard"].includes(p.skill)) return unknown();
  const skill=text(locale,p.skill==="check"?"merchant.skill.check":p.skill==="poison"?"merchant.skill.poison":"merchant.skill.guard"), target=p.targetId;
  if (type === "merchant_trade_committed") return text(locale,"console.merchant.trade",{actor,day,target,skill});
  return p.outcome==="granted"||p.outcome==="backlash" ? text(locale,"console.merchant.outcome",{actor,day,target,skill,outcome:text(locale,p.outcome==="granted"?"merchant.outcome.granted":"merchant.outcome.backlash")}) : unknown();
}
