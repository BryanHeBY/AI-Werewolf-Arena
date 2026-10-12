/**
 * Owns the exact supported locale identifiers shared by protocol consumers.
 * Input is unknown data; output is a Locale guard or the declared locale list.
 * No mutable current language or display dictionary is stored in this contract.
 */
export const LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
