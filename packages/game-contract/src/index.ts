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

export * from "./board-policy-identifiers";

export * from "./boards";
export type { ReadonlyBoardConfig } from "./board-parameters";

export type { LoversComponent } from "./cupid-relation";

export { boardConfigSchema } from "./board-schema";

export * from "./actions";

export * from "./facts/nightmare";

export * from "./facts/red-moon";

export * from "./facts/demon-hunter";

export * from "./facts/radiant-eclipse";

export * from "./facts/mist-raven";

export * from "./facts/noble-secret-body";

export * from "./facts/fragrant-pair-seer";

export * from "./facts/animal-dream";

export * from "./facts/cupid";

export * from "./facts/debate";

export * from "./facts/ghost-bride";

export * from "./facts/thief";

export * from "./facts/shapeshifter";

export * from "./facts/wild-child";

export * from "./facts/lonely-girl";

export * from "./facts/wall-notes";

export * from "./events";

export * from "./requests";

export * from "./facts/hybrid";

export * from "./facts/awakened";

export * from "./facts/mechanical";

export * from "./facts/merchant";

export * from "./facts/death-ability";

export * from "./facts/black-market";

export type {
  SeerState,
  SeerReadState,
  RoleInspectionState,
  RoleInspectionReadState,
  GuardState,
  GuardReadState,
  WitchState,
  WitchReadState,
  DreamerState,
  DreamerReadState,
  Pair,
  PairCheck,
  PairSeerState,
  EclipseSuppression,
  ShelterState,
  NightAbilityStates,
  RoleInspectionPolicy,
  NightAbilityKind,
  AbilitySource,
  NightAbilityReadStates,
  NightAbilityReadState,
} from "./night-ability-data";

export type {
  HunterState,
  WolfKingState,
  WhiteWolfKingState,
  KnightState,
  GravekeeperReport,
  GravekeeperState,
  WolfBeautyState,
  BearState,
  HiddenWolfState,
  GargoyleState,
  IdiotState,
  MechanicalMode,
  MechanicalSkill,
  MechanicalLearning,
  MechanicalState,
  AwakenedSkill,
  AwakenedActiveSkill,
  AwakenedTemplateRole,
  AwakenedLearning,
  AwakenedState,
  MiracleSkill,
  MerchantState,
  BlackMarketSkill,
  BlackMarketState,
  HunterReadState,
  WolfKingReadState,
  WhiteWolfKingReadState,
  KnightReadState,
  IdiotReadState,
  HiddenWolfReadState,
  GargoyleReadState,
  BearReadState,
  WolfBeautyReadState,
  GravekeeperReadReport,
  GravekeeperReadState,
  MechanicalReadSkill,
  MechanicalReadLearning,
  MechanicalReadState,
  AwakenedReadSkill,
  AwakenedReadActiveSkill,
  AwakenedReadLearning,
  AwakenedReadState,
  MerchantReadState,
  BlackMarketReadState,
} from "./role-state-data";
