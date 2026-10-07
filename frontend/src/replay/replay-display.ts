import { isLocale } from "@ai-werewolf-arena/game-catalog";
import type { Locale } from "@ai-werewolf-arena/game-text";

export type ReplayDisplayOptions = { locale: Locale; timeZone: string };
export const DEFAULT_REPLAY_TIME_ZONE = "UTC";
export const REPLAY_TIME_ZONES = ["UTC", "Asia/Shanghai", "America/New_York", "Europe/London"] as const;
export function validateReplayDisplay(options: ReplayDisplayOptions): void {
  if (!isLocale(options.locale)) throw new Error("replay_display_locale_invalid");
  if (typeof options.timeZone !== "string" || !options.timeZone.trim()) throw new Error("replay_display_time_zone_invalid");
  try { new Intl.DateTimeFormat(options.locale, { timeZone: options.timeZone }); }
  catch { throw new Error("replay_display_time_zone_invalid"); }
}
/** Offset-less historical timestamps are raw text, never interpreted in the host time zone. */
export function formatReplayTime(timestamp: string | undefined, options: ReplayDisplayOptions): string {
  validateReplayDisplay(options);
  if (!timestamp) return "—";
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return timestamp;
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return timestamp;
  const parts = new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")} [${options.timeZone}]`;
}
