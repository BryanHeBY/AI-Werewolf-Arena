/**
 * Defines runtime death-shot selection and source eligibility for domain callers.
 * Inputs are original-life handles, cause lists, policy and source phase; outputs
 * are selection types and the existing permitsDeathShot/permitsHunterShot result.
 * This module owns the eligibility algorithm and retains its exact order and
 * rejection policy. Serialized causes come from the contract owner; callbacks
 * and component references never become archive data or transferable authority.
 */
import { Phase } from "./identity";
import type { DeathActionPolicy } from "./board";
import type { NightLifeScope } from "./night_effects";
import { DeathCause } from "@ai-werewolf-arena/game-contract";
export { DeathCause } from "@ai-werewolf-arena/game-contract";
export type { DeathSources } from "@ai-werewolf-arena/game-contract";

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
