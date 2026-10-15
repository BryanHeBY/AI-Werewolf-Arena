/**
 * 负责按既有公共目录顺序维护六十四个机器角色 ID。输入为已交付 Role 枚举或九个规划身份，输出封闭 RoleId 联合、兼容数组与准确的成员判定。
 * 角色元数据和运行注册另有所有者，规划 ID 不进入可执行 Role 枚举；公共数组保持可变 API，判定读取私有规范序列而不受外部数组修改影响。
 */
import { Role } from "./identity";

/** 规划身份只作目录元数据，不属于可执行 Role 枚举。 */
export const PLANNED_ROLE_IDS = {
  SilenceElder: "silence_elder",
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
  Role.Crow,
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
/** 保留原可变数组 API；成员判定不把外部可写数组当作角色 ID 的权威集合。 */
export const ROLE_IDS: RoleId[] = [...canonicalRoleIds];
export function isRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && (canonicalRoleIds as readonly string[]).includes(value);
}
