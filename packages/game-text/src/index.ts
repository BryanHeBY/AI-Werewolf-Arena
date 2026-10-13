/**
 * 向后端与浏览器公开冻结的两语词典、严格占位格式化及原事实兼容出口。
 * 输入为每次调用的语言、消息 ID 和参数；输出保留原错误码、完整参数校验和用户原文。
 * 展示映射由 game-presentation 消费此词典 owner；本模块不授予行动或资源权限。
 * 事实兼容出口仅转发原契约，退出工作在 C44 单独核对，不能把它们当作第二 reader。
 */

export { AWAKENED_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/awakened";

export { MECHANICAL_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/mechanical";

import type { MessageKey, MessageRef } from "@ai-werewolf-arena/game-contract";

export * from "./animal-dream";

export {
  readWildChildEventFact,
  readWildChildPlayerFact,
  WILD_CHILD_EVENT_TYPES,
} from "./wild-child";

export {
  readShapeshifterEventFact,
  readShapeshifterChoiceTool,
  SHAPESHIFTER_EVENT_TYPES,
} from "./shapeshifter";

export { readThiefEventFact, THIEF_EVENT_TYPES } from "./thief";
export { copyEventData } from "./event-data";

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
} from "@ai-werewolf-arena/game-catalog";

export { DEBATE_EVENT_TYPES, readDebateEventFact } from "./debate";

export { CUPID_EVENT_TYPES, readCupidEventFact } from "./cupid";
import { zhCN } from "./zh-CN";
import { en } from "./en";

export type { Locale, MessageKey, MessageRef };
export const dictionaries = Object.freeze({ "zh-CN": zhCN, en });
const placeholderPattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(placeholderPattern)].map((match) => match[1]))].sort();
}

/** 语言在每次调用显式给出，不依赖可变的进程级语言设置。 */
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

/** 机器错误 ID 保持稳定，仅渲染其供人阅读的说明。 */
export function errorMessage(locale: Locale, code: string): string {
  const key = `error.${code}` as MessageKey;
  return Object.hasOwn(zhCN, key)
    ? text(locale, key)
    : text(locale, "tool.unknown_error", { code });
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

export * from "./lonely-girl";

export * from "./ghost-bride";

export * from "./demon-hunter";

export { PURE_WHITE_POLICY } from "@ai-werewolf-arena/game-contract";
export { EVIL_KNIGHT_POLICY } from "@ai-werewolf-arena/game-contract";

export { NIGHTMARE_SHADOW_POLICY } from "@ai-werewolf-arena/game-contract";

export * from "./nightmare";

export * from "./red-moon";

export * from "./magician";

export * from "./order-prince";

export * from "./trickster";

export * from "./wolf-sorcerer";

export * from "./time-consort";

export * from "./scholar-mentor";

export * from "./mist-raven";

export * from "./radiant-eclipse";

export * from "./noble-secret-body";

export * from "./fragrant-pair-seer";

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
