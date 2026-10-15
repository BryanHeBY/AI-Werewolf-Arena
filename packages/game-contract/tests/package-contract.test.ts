/**
 * 包级单元／类型契约测试验证身份标识兼容性。
 * 独立预期为固定 Git 27a97cb 捕获的枚举值／成员顺序及 64 角色目录顺序，不由新 canonical 实现生成。
 * 核对运行枚举、成员类型、原始 RoleId 和 locale 拒绝；公开目录不等于可运行角色集合，不执行引擎、目录算法或配置。
 */
import { describe, expect, test } from "bun:test";
import {
  Camp,
  Role,
  Phase,
  ActionWindow,
  KnightDuelWindow,
  StatusMark,
  WinCondition,
  PotionType,
  WitchSelfHealRule,
  ROLE_IDS,
  PLANNED_ROLE_IDS,
  isRoleId,
  LOCALES,
  isLocale,
  EVENT_PACK_IDS,
  EVENT_IDS,
  ITEM_IDS,
  type EntityId,
  type RoleId,
  type Locale,
  type TieBreakerStrategy,
} from "@ai-werewolf-arena/game-contract";

// 迁移前的字面值；这些预期记录不是运行时 ID 来源。
const baselineEnums = {
  Camp: {
    Good: "good",
    Wolf: "wolf",
    ThirdParty: "third_party",
  },
  Role: {
    FragrantPhantom: "fragrant_phantom",
    AwakenedSeer: "awakened_seer",
    NightNoble: "night_noble",
    AwakenedIdiot: "awakened_idiot",
    RadiantCount: "radiant_count",
    EclipseMaid: "eclipse_maid",
    Alchemist: "alchemist",
    RavenClawWolf: "raven_claw_wolf",
    Wolf: "wolf",
    WolfKing: "wolf_king",
    WhiteWolfKing: "white_wolf_king",
    Knight: "knight",
    Gravekeeper: "gravekeeper",
    Dreamer: "dreamer",
    WolfBeauty: "wolf_beauty",
    Bear: "bear",
    WhiteCat: "white_cat",
    FoxCub: "fox_cub",
    Pufferfish: "pufferfish",
    CursedFox: "cursed_fox",
    Cupid: "cupid",
    Debater: "debater",
    Thief: "thief",
    Shapeshifter: "shapeshifter",
    WildChild: "wild_child",
    LonelyGirl: "lonely_girl",
    DemonHunter: "demon_hunter",
    PureWhiteGirl: "pure_white_girl",
    WolfWitch: "wolf_witch",
    EvilKnight: "evil_knight",
    NightmareShadow: "nightmare",
    RedMoonApostle: "red_moon_apostle",
    DayScholar: "day_scholar",
    NightMentor: "night_mentor",
    TimeWolfConsort: "time_wolf_consort",
    WolfSorcerer: "wolf_sorcerer",
    Trickster: "trickster",
    OrderPrince: "order_prince",
    Magician: "magician",
    GhostBride: "ghost_bride",
    HiddenWolf: "hidden_wolf",
    Gargoyle: "gargoyle",
    Psychic: "psychic",
    MirrorGirl: "mirror_girl",
    MechanicalWolf: "mechanical_wolf",
    AwakenedHiddenWolf: "awakened_hidden_wolf",
    MiracleMerchant: "miracle_merchant",
    BlackMarketMerchant: "black_market_merchant",
    Hybrid: "hybrid",
    Villager: "villager",
    Seer: "seer",
    Guard: "guard",
    Witch: "witch",
    Hunter: "hunter",
    Idiot: "idiot",
  },
  Phase: {
    Night: "night",
    Day: "day",
    Voting: "voting",
    GameOver: "game_over",
  },
  ActionWindow: {
    OnDaybreak: "on_daybreak",
    OnPreElection: "on_pre_election",
    OnPreVote: "on_pre_vote",
    OnPerSpeechGap: "on_per_speech_gap",
  },
  KnightDuelWindow: {
    BeforeSpeeches: "before_speeches",
    BetweenSpeeches: "between_speeches",
    AfterSpeeches: "after_speeches",
  },
  StatusMark: {
    GuardMark: "GuardMark",
    WolfKillMark: "WolfKillMark",
    HealMark: "HealMark",
    PoisonMark: "PoisonMark",
  },
  WinCondition: {
    ThreeFactionsElimination: "three_factions_elimination",
    SlaughterCity: "slaughter_city",
    SlaughterSide: "slaughter_side",
    WolfReachHalf: "wolf_reach_half",
  },
  PotionType: {
    Heal: "heal",
    Poison: "poison",
    None: "none",
  },
  WitchSelfHealRule: {
    Disabled: "disabled",
    FirstNightOnly: "first_night_only",
    Always: "always",
  },
} as const;
const baselineCatalogOrder = [
  "wolf",
  "villager",
  "seer",
  "witch",
  "hunter",
  "guard",
  "idiot",
  "wolf_king",
  "white_wolf_king",
  "knight",
  "gravekeeper",
  "dreamer",
  "wolf_beauty",
  "bear",
  "hidden_wolf",
  "gargoyle",
  "psychic",
  "mirror_girl",
  "mechanical_wolf",
  "miracle_merchant",
  "black_market_merchant",
  "hybrid",
  "thief",
  "shapeshifter",
  "lonely_girl",
  "wild_child",
  "ghost_bride",
  "cupid",
  "cursed_fox",
  "demon_hunter",
  "pure_white_girl",
  "wolf_witch",
  "evil_knight",
  "red_moon_apostle",
  "alchemist",
  "raven_claw_wolf",
  "radiant_count",
  "eclipse_maid",
  "night_noble",
  "fragrant_phantom",
  "nightmare",
  "magician",
  "trickster",
  "wolf_sorcerer",
  "order_prince",
  "time_wolf_consort",
  "day_scholar",
  "night_mentor",
  "debater",
  "silence_elder",
  "crow",
  "white_cat",
  "fox_cub",
  "pufferfish",
  "warden",
  "awakened_idiot",
  "awakened_seer",
  "awakened_wolf_king",
  "awakened_hidden_wolf",
  "awakened_wolf_beauty",
  "awakened_witch",
  "awakened_hunter",
  "awakened_guard",
  "awakened_knight",
] as const;

describe("pure identity public package contract", () => {
  test("all runtime enums retain their original member keys, values and iteration order", () => {
    const actual = {
      Camp,
      Role,
      Phase,
      ActionWindow,
      KnightDuelWindow,
      StatusMark,
      WinCondition,
      PotionType,
      WitchSelfHealRule,
    };
    for (const name of Object.keys(baselineEnums) as Array<keyof typeof baselineEnums>) {
      expect<unknown>(actual[name]).toEqual(baselineEnums[name]);
      expect(Object.keys(actual[name])).toEqual(Object.keys(baselineEnums[name]));
      expect<unknown>(Object.values(actual[name])).toEqual(Object.values(baselineEnums[name]));
    }
    expect(Object.values(Role)).toHaveLength(55);
    expect(Object.values(Role)).not.toContain("awakened_knight" as Role);
  });

  test("catalog IDs retain their independent 64-entry order without granting planned roles execution", () => {
    expect<unknown>(ROLE_IDS).toEqual(baselineCatalogOrder);
    expect(new Set(ROLE_IDS).size).toBe(64);
    expect(Object.values(PLANNED_ROLE_IDS)).toHaveLength(9);
    for (const role of baselineCatalogOrder) expect(isRoleId(role)).toBe(true);
    for (const value of [null, undefined, 2, {}, [], "Wolf", "not_a_role", ""])
      expect(isRoleId(value)).toBe(false);
    expect(isRoleId("awakened_knight")).toBe(true);
    expect(Object.keys(Role)).not.toContain("AwakenedKnight");
  });

  test("the compatibility array remains mutable while exact ID validation keeps its private canonical source", () => {
    const original = [...ROLE_IDS];
    try {
      ROLE_IDS.splice(0, ROLE_IDS.length, "wolf");
      expect(ROLE_IDS).toEqual(["wolf"]);
      expect(isRoleId("seer")).toBe(true);
      expect(isRoleId("crow")).toBe(true);
      expect(isRoleId("not_a_role")).toBe(false);
    } finally {
      ROLE_IDS.splice(0, ROLE_IDS.length, ...original);
    }
    expect<unknown>(ROLE_IDS).toEqual(baselineCatalogOrder);
  });

  test("enum member types and raw machine ID literals remain distinct compatible interfaces", () => {
    const scholar: Role.DayScholar = Role.DayScholar;
    const inspection: Role.Gargoyle | Role.Psychic | Role.MirrorGirl = Role.Gargoyle;
    const rawNative: RoleId = "wolf";
    const rawPlanned: RoleId = "awakened_knight";
    const entity: EntityId = 12;
    const locale: Locale = "en";
    const tie: TieBreakerStrategy = "no_elimination";
    // @ts-expect-error A different enum member cannot satisfy the original narrow member type.
    const wrongScholar: Role.DayScholar = Role.NightMentor;
    // @ts-expect-error Contract IDs remain a closed string union.
    const wrongRoleId: RoleId = "not_a_role";
    // @ts-expect-error Machine locale spelling stays exact.
    const wrongLocale: Locale = "en-US";
    void [wrongScholar, wrongRoleId, wrongLocale];
    expect(String(scholar)).toBe("day_scholar");
    expect(String(inspection)).toBe("gargoyle");
    expect(rawNative).toBe("wolf");
    expect(rawPlanned).toBe("awakened_knight");
    expect(entity).toBe(12);
    expect(locale).toBe("en");
    expect(tie).toBe("no_elimination");
  });

  test("locale and event identifiers retain exact protocol values with no display dependency", () => {
    expect(LOCALES).toEqual(["zh-CN", "en"]);
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("en")).toBe(true);
    for (const value of [null, {}, "zh", "en-US", "EN", ""]) expect(isLocale(value)).toBe(false);
    expect(EVENT_PACK_IDS).toEqual(["awa_wall_notes_once_v1"]);
    expect(EVENT_IDS).toEqual(["awa_wall_notes_v1"]);
    expect(ITEM_IDS).toEqual(["anonymous_note"]);
  });
});
