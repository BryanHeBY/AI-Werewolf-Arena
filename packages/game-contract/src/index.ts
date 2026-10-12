/**
 * Responsibility: expose pure protocol data for backend, catalog and browser consumers.
 * Outputs include machine identities, messages, results, errors and inert payload readers.
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

export * from "./outcomes";
export * from "./inspection";
export * from "./errors";
export { DeathCause } from "./death-facts";
export type { DeathSources } from "./death-facts";
export * from "./results";
