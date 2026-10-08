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
  Duel = "duel",
  Ability = "ability",
}
export type DeathSources = Record<number, DeathCause[]>;
export type DeathShotSelection =
  | { kind: "shot"; targetId: number; deathActionId: number }
  | { kind: "pass"; deathActionId: number }
  | { kind: "invalid" };

export function permitsDeathShot(sources: readonly DeathCause[]): boolean {
  return sources.length > 0 && sources.every(source => source === DeathCause.WolfKill || source === DeathCause.Exile || source === DeathCause.Shot || source === DeathCause.WhiteWolfBlast);
}
/** Existing Hunter API retains the same cause policy. */
export const permitsHunterShot = permitsDeathShot;
