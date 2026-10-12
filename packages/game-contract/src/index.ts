/**
 * Responsibility: expose pure protocol data for backend, catalog and browser consumers.
 * Outputs include machine identities, messages, results, errors and inert payload readers.
 * This package never grants runtime authority, executes rules, owns catalog
 * metadata or renders presentation. Its interfaces and readers describe inert data.
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

export { copyEventData } from "./inert-event-data";

export * from "./outcomes";
export * from "./inspection";
export * from "./errors";
export { DeathCause } from "./death-facts";
export type { DeathSources } from "./death-facts";
export * from "./results";
export { MESSAGE_IDS, isMessageKey } from "./message-ids";
export type { MessageKey } from "./message-ids";
export type { MessageRef } from "./message-refs";

export * from "./facts/scholar-mentor";

export * from "./facts/time-consort";

export * from "./facts/wolf-sorcerer";

export * from "./facts/trickster";

export * from "./facts/order-prince";

export * from "./facts/magician";
