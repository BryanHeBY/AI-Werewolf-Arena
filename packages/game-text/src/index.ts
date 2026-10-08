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
