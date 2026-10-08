import { isLocale, roleName as catalogRoleName, type Locale, type InspectionResult } from "@ai-werewolf-arena/game-catalog";
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
