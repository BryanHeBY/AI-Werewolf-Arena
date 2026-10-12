/**
 * Owns stable death-cause identifiers and serialized source lists.
 * Inputs are committed cause values; outputs retain every enum member, value
 * and iteration order. Damage, source eligibility, original-life handles and
 * death-shot callbacks remain domain execution responsibilities, not data.
 */
export enum DeathCause {
  WhiteCatExpiry = "white_cat_expiry",
  PufferRetaliation = "puffer_retaliation",
  FragrantLink = "fragrant_link",
  ServantExpiry = "servant_expiry",
  RadiantBacklash = "radiant_backlash",
  RavenClawKnife = "raven_claw_knife",
  WolfKill = "wolf_kill",
  Poison = "poison",
  EvilKnightReflection = "evil_knight_reflection",
  PureWhiteInspection = "pure_white_inspection",
  WolfWitchInspection = "wolf_witch_inspection",
  DemonHunt = "demon_hunt",
  DemonHuntBacklash = "demon_hunt_backlash",
  Shot = "shot",
  Exile = "exile",
  RedMoonExpiry = "red_moon_expiry",
  SelfDestruct = "self_destruct",
  WhiteWolfBlast = "white_wolf_blast",
  Lovers = "lovers",
  Dream = "dream",
  FoxInspection = "fox_inspection",
  Charm = "charm",
  Duel = "duel",
  DuelFailure = "duel_failure",
  Ability = "ability",
  MechanicalKnife = "mechanical_knife",
  AwakenedHiddenKnife = "awakened_hidden_knife",
  MechanicalGuardFailure = "mechanical_guard_failure",
  MerchantBacklash = "merchant_backlash",
  BlackMarketBacklash = "black_market_backlash",
}
export type DeathSources = Record<number, DeathCause[]>;
