import { Phase } from "./identity";
import type { DeathActionPolicy } from "./board";
import type { NightLifeScope } from "./night_effects";
/** Death facts are distinct from transient protection/damage marks. */
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
export type DeathShotSelection =
  | {
      kind: "shot";
      targetId: number;
      deathActionId: number;
      targetScope?: NightLifeScope;
      mappedMiss?: true;
      mappingCurrent?: () => boolean;
    }
  | { kind: "pass"; deathActionId: number }
  | { kind: "invalid" };

export function permitsDeathShot(
  sources: readonly DeathCause[],
  policy: DeathActionPolicy = "awa_qualified_sources_v1",
  deathPhase?: Phase,
): boolean {
  if (policy === "awa_day_deaths_v1" && deathPhase !== Phase.Day && deathPhase !== Phase.Voting)
    return false;
  if (
    policy !== "awa_qualified_sources_v1" &&
    policy !== "awa_knife_or_exile_v1" &&
    policy !== "awa_day_deaths_v1"
  )
    return false;
  return (
    sources.length > 0 &&
    sources.every(
      (source) =>
        source === DeathCause.WolfKill ||
        source === DeathCause.MechanicalKnife ||
        source === DeathCause.AwakenedHiddenKnife ||
        source === DeathCause.Exile ||
        (policy !== "awa_knife_or_exile_v1" &&
          (source === DeathCause.Shot || source === DeathCause.WhiteWolfBlast)),
    )
  );
}
/** Existing Hunter API retains the same cause policy. */
export const permitsHunterShot = permitsDeathShot;
