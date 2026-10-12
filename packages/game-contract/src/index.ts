/**
 * Public pure-contract exit for backend, catalog and browser protocol consumers.
 * Exports stable identity enums, role IDs and locale/event identifiers only.
 * Runtime authorization, rules, catalog metadata and presentation stay outside.
 */
export {
  Camp,
  Role,
  Phase,
  ActionWindow,
  KnightDuelWindow,
  StatusMark,
  WinCondition,
  PotionType,
  WitchSelfHealRule,
} from "./identity";
export type { EntityId, TieBreakerStrategy } from "./identity";
export { ROLE_IDS, PLANNED_ROLE_IDS, isRoleId } from "./role-ids";
export type { RoleId } from "./role-ids";
export { LOCALES, isLocale } from "./locale";
export type { Locale } from "./locale";
export { EVENT_PACK_IDS, EVENT_IDS, ITEM_IDS } from "./event-ids";
