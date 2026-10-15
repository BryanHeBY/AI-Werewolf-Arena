/**
 * 包单元测试负责角色名称词典及原回退政策。输入为迁移前冻结的六十四组独立字面预期、未知文字与显式语言；
 * 输出逐项核对一百二十八个名称，不从本次生产表生成运行预期，也不把名称／规划身份当成规则支持证明。
 * 另外核对未知 ID 原样返回、中文默认、无共享语言状态及 locale 错误；不运行角色、World、Provider 或归档重放。
 */
import { expect, test } from "bun:test";
import { ROLE_IDS, type Locale } from "@ai-werewolf-arena/game-contract";
import { roleName } from "@ai-werewolf-arena/game-text";

// 这是原公共输出的测试快照，不是第二份生产词典；来源及逐项原／新相等记录随本批 before 包保存。
const expectedNames = [
  ["wolf", "狼人", "Werewolf"],
  ["villager", "平民", "Villager"],
  ["seer", "预言家", "Seer"],
  ["witch", "女巫", "Witch"],
  ["hunter", "猎人", "Hunter"],
  ["guard", "守卫", "Guard"],
  ["idiot", "白痴", "Village Idiot"],
  ["wolf_king", "狼王", "Wolf King"],
  ["white_wolf_king", "白狼王", "White Wolf King"],
  ["knight", "骑士", "Knight"],
  ["gravekeeper", "守墓人", "Gravekeeper"],
  ["dreamer", "摄梦人", "Dreamer"],
  ["wolf_beauty", "狼美人", "Wolf Beauty"],
  ["bear", "熊", "Bear"],
  ["hidden_wolf", "隐狼", "Hidden Wolf"],
  ["gargoyle", "石像鬼", "Gargoyle"],
  ["psychic", "通灵师", "Spirit Seer"],
  ["mirror_girl", "魔镜少女", "Mirror Girl"],
  ["mechanical_wolf", "机械狼", "Mechanical Wolf"],
  ["miracle_merchant", "奇迹商人", "Miracle Merchant"],
  ["black_market_merchant", "黑市商人", "Black Market Merchant"],
  ["hybrid", "混血儿", "Hybrid"],
  ["thief", "盗贼", "Thief"],
  ["shapeshifter", "千面人", "Many-Faced One"],
  ["lonely_girl", "孤独少女", "Lonely Girl"],
  ["wild_child", "野孩子", "Wild Child"],
  ["ghost_bride", "鬼魂新娘", "Ghost Bride"],
  ["cupid", "丘比特", "Cupid"],
  ["cursed_fox", "咒狐", "Cursed Fox"],
  ["demon_hunter", "猎魔人", "Demon Hunter"],
  ["pure_white_girl", "纯白之女", "Pure White Girl"],
  ["wolf_witch", "狼巫", "Wolf Witch"],
  ["evil_knight", "恶夜骑士", "Dark Knight"],
  ["red_moon_apostle", "赤月使徒", "Red Moon Apostle"],
  ["alchemist", "炼金魔女", "Alchemist"],
  ["raven_claw_wolf", "狼鸦之爪", "Raven-Claw Wolf"],
  ["radiant_count", "流光伯爵", "Radiant Count"],
  ["eclipse_maid", "蚀日侍女", "Eclipse Maid"],
  ["night_noble", "夜之贵族", "Night Noble"],
  ["fragrant_phantom", "寻香魅影", "Fragrant Phantom"],
  ["nightmare", "噩梦之影", "Nightmare"],
  ["magician", "魔术师", "Magician"],
  ["trickster", "诡术师", "Trickster"],
  ["wolf_sorcerer", "狼术师", "Wolf Sorcerer"],
  ["order_prince", "定序王子", "Order Prince"],
  ["time_wolf_consort", "蚀时狼妃", "Time-Wolf Consort"],
  ["day_scholar", "白昼学者", "Day Scholar"],
  ["night_mentor", "寂夜导师", "Night Mentor"],
  ["debater", "杠精", "Debater"],
  ["silence_elder", "禁言长老", "Silencing Elder"],
  ["crow", "乌鸦", "Crow"],
  ["white_cat", "白猫", "White Cat"],
  ["fox_cub", "子狐", "Fox Cub"],
  ["pufferfish", "河豚", "Pufferfish"],
  ["warden", "典狱长", "Warden"],
  ["awakened_idiot", "觉醒愚者", "Awakened Village Idiot"],
  ["awakened_seer", "觉醒预言家", "Awakened Seer"],
  ["awakened_wolf_king", "觉醒狼王", "Awakened Wolf King"],
  ["awakened_hidden_wolf", "觉醒隐狼", "Awakened Hidden Wolf"],
  ["awakened_wolf_beauty", "觉醒狼美人", "Awakened Wolf Beauty"],
  ["awakened_witch", "觉醒女巫", "Awakened Witch"],
  ["awakened_hunter", "觉醒猎人", "Awakened Hunter"],
  ["awakened_guard", "觉醒守卫", "Awakened Guard"],
  ["awakened_knight", "觉醒骑士", "Awakened Knight"],
] as const;

test("all 64 names preserve both original literal locales and stable ID order", () => {
  expect(expectedNames.map(([id]) => id)).toEqual(ROLE_IDS);
  expect(new Set(expectedNames.map(([id]) => id)).size).toBe(64);
  for (const [id, chinese, english] of expectedNames) {
    expect(roleName(id, "zh-CN")).toBe(chinese);
    expect(roleName(id, "en")).toBe(english);
  }
});

test("role name fallback preserves original user text and never selects object prototype names", () => {
  for (const id of [
    "Custom {role}",
    "用户原文\nExact label",
    "",
    "constructor",
    "__proto__",
    "toString",
  ])
    for (const locale of ["zh-CN", "en"] as const) expect(roleName(id, locale)).toBe(id);
  const opaque = {
    toString() {
      throw new Error("must_not_coerce_role_id");
    },
  };
  // 公共类型仍为 string；保原未类型化 caller 的严格相等／原值回退，不新增隐式 String 或 schema 准入。
  expect(roleName(opaque as unknown as string, "en")).toBe(opaque as unknown as string);
});

test("role name locale validation and explicit interleaving keep the original policy", () => {
  expect(roleName("wolf")).toBe("狼人");
  expect([roleName("wolf", "en"), roleName("wolf", "zh-CN"), roleName("wolf", "en")]).toEqual([
    "Werewolf",
    "狼人",
    "Werewolf",
  ]);
  for (const locale of ["zh", "en-US", "EN", "", null, 3, {}])
    expect(() => roleName("Custom {role}", locale as Locale)).toThrow("i18n_locale_invalid");
});
