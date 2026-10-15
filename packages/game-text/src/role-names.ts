/**
 * 负责六十四个稳定角色 ID 的中文／英文名称词典及公开名称查询；包括五十五个运行身份和九个规划身份。
 * 输入为原角色 ID 与显式语言，输出原名称字面值；未知 ID 原样返回，不将用户文字当 key、占位模板或运行许可。
 * 名称只在本模块维护，资料状态与规则卡仍由 game-catalog 拥有；本模块仅依赖机器契约，不加载 Catalog、World 或规则。
 * 私有表按原目录顺序保存，不公开第二个可写名称入口；查找保严格相等，不通过对象属性索引强制转换未知输入。
 */
import { Role, PLANNED_ROLE_IDS, isLocale, type Locale } from "@ai-werewolf-arena/game-contract";

/** 双语字符串是显示资料，不是阵营、库存或身份转换的权威；规划名称不代表已注册 profile。 */
const roleNames = [
  { id: `${Role.Wolf}`, names: { "zh-CN": "狼人", en: "Werewolf" } },
  { id: `${Role.Villager}`, names: { "zh-CN": "平民", en: "Villager" } },
  { id: `${Role.Seer}`, names: { "zh-CN": "预言家", en: "Seer" } },
  { id: `${Role.Witch}`, names: { "zh-CN": "女巫", en: "Witch" } },
  { id: `${Role.Hunter}`, names: { "zh-CN": "猎人", en: "Hunter" } },
  { id: `${Role.Guard}`, names: { "zh-CN": "守卫", en: "Guard" } },
  { id: `${Role.Idiot}`, names: { "zh-CN": "白痴", en: "Village Idiot" } },
  { id: `${Role.WolfKing}`, names: { "zh-CN": "狼王", en: "Wolf King" } },
  { id: `${Role.WhiteWolfKing}`, names: { "zh-CN": "白狼王", en: "White Wolf King" } },
  { id: `${Role.Knight}`, names: { "zh-CN": "骑士", en: "Knight" } },
  { id: `${Role.Gravekeeper}`, names: { "zh-CN": "守墓人", en: "Gravekeeper" } },
  { id: `${Role.Dreamer}`, names: { "zh-CN": "摄梦人", en: "Dreamer" } },
  { id: `${Role.WolfBeauty}`, names: { "zh-CN": "狼美人", en: "Wolf Beauty" } },
  { id: `${Role.Bear}`, names: { "zh-CN": "熊", en: "Bear" } },
  { id: `${Role.HiddenWolf}`, names: { "zh-CN": "隐狼", en: "Hidden Wolf" } },
  { id: `${Role.Gargoyle}`, names: { "zh-CN": "石像鬼", en: "Gargoyle" } },
  { id: `${Role.Psychic}`, names: { "zh-CN": "通灵师", en: "Spirit Seer" } },
  { id: `${Role.MirrorGirl}`, names: { "zh-CN": "魔镜少女", en: "Mirror Girl" } },
  { id: `${Role.MechanicalWolf}`, names: { "zh-CN": "机械狼", en: "Mechanical Wolf" } },
  { id: `${Role.MiracleMerchant}`, names: { "zh-CN": "奇迹商人", en: "Miracle Merchant" } },
  {
    id: `${Role.BlackMarketMerchant}`,
    names: { "zh-CN": "黑市商人", en: "Black Market Merchant" },
  },
  { id: `${Role.Hybrid}`, names: { "zh-CN": "混血儿", en: "Hybrid" } },
  { id: `${Role.Thief}`, names: { "zh-CN": "盗贼", en: "Thief" } },
  { id: `${Role.Shapeshifter}`, names: { "zh-CN": "千面人", en: "Many-Faced One" } },
  { id: `${Role.LonelyGirl}`, names: { "zh-CN": "孤独少女", en: "Lonely Girl" } },
  { id: `${Role.WildChild}`, names: { "zh-CN": "野孩子", en: "Wild Child" } },
  { id: `${Role.GhostBride}`, names: { "zh-CN": "鬼魂新娘", en: "Ghost Bride" } },
  { id: `${Role.Cupid}`, names: { "zh-CN": "丘比特", en: "Cupid" } },
  { id: `${Role.CursedFox}`, names: { "zh-CN": "咒狐", en: "Cursed Fox" } },
  { id: `${Role.DemonHunter}`, names: { "zh-CN": "猎魔人", en: "Demon Hunter" } },
  { id: `${Role.PureWhiteGirl}`, names: { "zh-CN": "纯白之女", en: "Pure White Girl" } },
  { id: `${Role.WolfWitch}`, names: { "zh-CN": "狼巫", en: "Wolf Witch" } },
  { id: `${Role.EvilKnight}`, names: { "zh-CN": "恶夜骑士", en: "Dark Knight" } },
  { id: `${Role.RedMoonApostle}`, names: { "zh-CN": "赤月使徒", en: "Red Moon Apostle" } },
  { id: `${Role.Alchemist}`, names: { "zh-CN": "炼金魔女", en: "Alchemist" } },
  { id: `${Role.RavenClawWolf}`, names: { "zh-CN": "狼鸦之爪", en: "Raven-Claw Wolf" } },
  { id: `${Role.RadiantCount}`, names: { "zh-CN": "流光伯爵", en: "Radiant Count" } },
  { id: `${Role.EclipseMaid}`, names: { "zh-CN": "蚀日侍女", en: "Eclipse Maid" } },
  { id: `${Role.NightNoble}`, names: { "zh-CN": "夜之贵族", en: "Night Noble" } },
  { id: `${Role.FragrantPhantom}`, names: { "zh-CN": "寻香魅影", en: "Fragrant Phantom" } },
  { id: `${Role.NightmareShadow}`, names: { "zh-CN": "噩梦之影", en: "Nightmare" } },
  { id: `${Role.Magician}`, names: { "zh-CN": "魔术师", en: "Magician" } },
  { id: `${Role.Trickster}`, names: { "zh-CN": "诡术师", en: "Trickster" } },
  { id: `${Role.WolfSorcerer}`, names: { "zh-CN": "狼术师", en: "Wolf Sorcerer" } },
  { id: `${Role.OrderPrince}`, names: { "zh-CN": "定序王子", en: "Order Prince" } },
  { id: `${Role.TimeWolfConsort}`, names: { "zh-CN": "蚀时狼妃", en: "Time-Wolf Consort" } },
  { id: `${Role.DayScholar}`, names: { "zh-CN": "白昼学者", en: "Day Scholar" } },
  { id: `${Role.NightMentor}`, names: { "zh-CN": "寂夜导师", en: "Night Mentor" } },
  { id: `${Role.Debater}`, names: { "zh-CN": "杠精", en: "Debater" } },
  { id: Role.SilenceElder, names: { "zh-CN": "禁言长老", en: "Silencing Elder" } },
  { id: Role.Crow, names: { "zh-CN": "乌鸦", en: "Crow" } },
  { id: `${Role.WhiteCat}`, names: { "zh-CN": "白猫", en: "White Cat" } },
  { id: `${Role.FoxCub}`, names: { "zh-CN": "子狐", en: "Fox Cub" } },
  { id: `${Role.Pufferfish}`, names: { "zh-CN": "河豚", en: "Pufferfish" } },
  { id: Role.Warden, names: { "zh-CN": "典狱长", en: "Warden" } },
  { id: `${Role.AwakenedIdiot}`, names: { "zh-CN": "觉醒愚者", en: "Awakened Village Idiot" } },
  { id: `${Role.AwakenedSeer}`, names: { "zh-CN": "觉醒预言家", en: "Awakened Seer" } },
  {
    id: Role.AwakenedWolfKing,
    names: { "zh-CN": "觉醒狼王", en: "Awakened Wolf King" },
  },
  { id: `${Role.AwakenedHiddenWolf}`, names: { "zh-CN": "觉醒隐狼", en: "Awakened Hidden Wolf" } },
  {
    id: PLANNED_ROLE_IDS.AwakenedWolfBeauty,
    names: { "zh-CN": "觉醒狼美人", en: "Awakened Wolf Beauty" },
  },
  { id: PLANNED_ROLE_IDS.AwakenedWitch, names: { "zh-CN": "觉醒女巫", en: "Awakened Witch" } },
  { id: PLANNED_ROLE_IDS.AwakenedHunter, names: { "zh-CN": "觉醒猎人", en: "Awakened Hunter" } },
  { id: PLANNED_ROLE_IDS.AwakenedGuard, names: { "zh-CN": "觉醒守卫", en: "Awakened Guard" } },
  { id: PLANNED_ROLE_IDS.AwakenedKnight, names: { "zh-CN": "觉醒骑士", en: "Awakened Knight" } },
] as const satisfies readonly {
  readonly id: string;
  readonly names: Readonly<Record<Locale, string>>;
}[];

/** 先核原 locale；默认中文、未知 ID 回退与调用间语言隔离均保持，不回退到另一语言。 */
export function roleName(id: string, locale: Locale = "zh-CN"): string {
  if (!isLocale(locale)) throw new Error("i18n_locale_invalid");
  return roleNames.find((item) => item.id === id)?.names[locale] ?? id;
}
