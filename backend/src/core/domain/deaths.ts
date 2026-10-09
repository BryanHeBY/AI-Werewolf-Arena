import type { NightLifeScope } from "./night_effects";
/** Death facts are distinct from transient protection/damage marks. */
export enum DeathCause {
  WolfKill = "wolf_kill",
  Poison = "poison",
  Shot = "shot",
  Exile = "exile",
  SelfDestruct = "self_destruct",
  WhiteWolfBlast = "white_wolf_blast",
  Lovers = "lovers",
  Dream = "dream",
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
  | { kind: "shot"; targetId: number; deathActionId: number; targetScope?: NightLifeScope }
  | { kind: "pass"; deathActionId: number }
  | { kind: "invalid" };

export function permitsDeathShot(sources: readonly DeathCause[]): boolean {
  return (
    sources.length > 0 &&
    sources.every(
      (source) =>
        source === DeathCause.WolfKill ||
        source === DeathCause.MechanicalKnife ||
        source === DeathCause.AwakenedHiddenKnife ||
        source === DeathCause.Exile ||
        source === DeathCause.Shot ||
        source === DeathCause.WhiteWolfBlast,
    )
  );
}
/** Existing Hunter API retains the same cause policy. */
export const permitsHunterShot = permitsDeathShot;
