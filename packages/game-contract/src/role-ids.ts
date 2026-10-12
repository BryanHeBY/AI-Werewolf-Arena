/**
 * Owns all 64 machine role IDs in their existing public catalog order.
 * Inputs reference delivered Role enum values or the nine declared planned
 * identities; outputs are the closed RoleId string union, compatibility array
 * and exact predicate. Role metadata and registration remain separate owners.
 * The public array retains its existing mutable API. Validation reads a private
 * canonical sequence, so caller array edits cannot change the accepted ID set.
 */
import { Role } from "./identity";

/** Planned identities are metadata only, never members of the executable Role enum. */
export const PLANNED_ROLE_IDS = {
  SilenceElder: "silence_elder",
  Crow: "crow",
  Warden: "warden",
  AwakenedWolfKing: "awakened_wolf_king",
  AwakenedWolfBeauty: "awakened_wolf_beauty",
  AwakenedWitch: "awakened_witch",
  AwakenedHunter: "awakened_hunter",
  AwakenedGuard: "awakened_guard",
  AwakenedKnight: "awakened_knight",
} as const;

const canonicalRoleIds = [
  Role.Wolf,
  Role.Villager,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Guard,
  Role.Idiot,
  Role.WolfKing,
  Role.WhiteWolfKing,
  Role.Knight,
  Role.Gravekeeper,
  Role.Dreamer,
  Role.WolfBeauty,
  Role.Bear,
  Role.HiddenWolf,
  Role.Gargoyle,
  Role.Psychic,
  Role.MirrorGirl,
  Role.MechanicalWolf,
  Role.MiracleMerchant,
  Role.BlackMarketMerchant,
  Role.Hybrid,
  Role.Thief,
  Role.Shapeshifter,
  Role.LonelyGirl,
  Role.WildChild,
  Role.GhostBride,
  Role.Cupid,
  Role.CursedFox,
  Role.DemonHunter,
  Role.PureWhiteGirl,
  Role.WolfWitch,
  Role.EvilKnight,
  Role.RedMoonApostle,
  Role.Alchemist,
  Role.RavenClawWolf,
  Role.RadiantCount,
  Role.EclipseMaid,
  Role.NightNoble,
  Role.FragrantPhantom,
  Role.NightmareShadow,
  Role.Magician,
  Role.Trickster,
  Role.WolfSorcerer,
  Role.OrderPrince,
  Role.TimeWolfConsort,
  Role.DayScholar,
  Role.NightMentor,
  Role.Debater,
  PLANNED_ROLE_IDS.SilenceElder,
  PLANNED_ROLE_IDS.Crow,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Pufferfish,
  PLANNED_ROLE_IDS.Warden,
  Role.AwakenedIdiot,
  Role.AwakenedSeer,
  PLANNED_ROLE_IDS.AwakenedWolfKing,
  Role.AwakenedHiddenWolf,
  PLANNED_ROLE_IDS.AwakenedWolfBeauty,
  PLANNED_ROLE_IDS.AwakenedWitch,
  PLANNED_ROLE_IDS.AwakenedHunter,
  PLANNED_ROLE_IDS.AwakenedGuard,
  PLANNED_ROLE_IDS.AwakenedKnight,
] as const;

export type RoleId = `${(typeof canonicalRoleIds)[number]}`;
/** Keep the original array API without using externally writable data as an ID oracle. */
export const ROLE_IDS: RoleId[] = [...canonicalRoleIds];
export function isRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && (canonicalRoleIds as readonly string[]).includes(value);
}
