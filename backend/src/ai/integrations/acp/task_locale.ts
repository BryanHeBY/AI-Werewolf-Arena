import { isLocale, type Locale } from "@ai-werewolf-arena/game-catalog";

/** The injected sidecar gets only its own task's language, never a mutable host-wide setting. */
export function taskLocale(environment: Readonly<Record<string, string | undefined>>): Locale {
  const locale = environment.AWA_TASK_LOCALE ?? "zh-CN";
  if (!isLocale(locale)) throw new Error("acp_task_locale_invalid");
  return locale;
}
