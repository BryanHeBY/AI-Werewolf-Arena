/**
 * 负责引擎与协议共同消费的稳定机器身份枚举。输入为声明的身份值；输出保留
 * 既有运行枚举名、成员顺序和枚举成员类型，中文注释不改变机器标识或序列化值。
 * Role 仅列出当前交付的 55 个角色；规划角色的元数据不能授予执行资格。
 * 本纯契约不访问 World、规则算法、文案、Node 或 React，不维护第二套角色身份。
 */
export type EntityId = number;

/** 阵营机器值与 Role 身份分开表达；当前阵营、胜利成员关系和玩家看到的标签由各自 owner 决定。 */
export enum Camp {
  Good = "good",
  Wolf = "wolf",
  ThirdParty = "third_party",
}

/** 角色名不固定推导当前阵营、胜负或狼队资格；现场身份与资源仍须原运行规则核对。 */
export enum Role {
  Crow = "crow",
  SilenceElder = "silence_elder",
  FragrantPhantom = "fragrant_phantom",
  AwakenedSeer = "awakened_seer",
  NightNoble = "night_noble",
  AwakenedIdiot = "awakened_idiot",
  RadiantCount = "radiant_count",
  EclipseMaid = "eclipse_maid",
  Alchemist = "alchemist",
  RavenClawWolf = "raven_claw_wolf",
  Wolf = "wolf",
  WolfKing = "wolf_king",
  WhiteWolfKing = "white_wolf_king",
  Knight = "knight",
  Gravekeeper = "gravekeeper",
  Dreamer = "dreamer",
  WolfBeauty = "wolf_beauty",
  Bear = "bear",
  WhiteCat = "white_cat",
  FoxCub = "fox_cub",
  Pufferfish = "pufferfish",
  CursedFox = "cursed_fox",
  Cupid = "cupid",
  Debater = "debater",
  Thief = "thief",
  Shapeshifter = "shapeshifter",
  WildChild = "wild_child",
  LonelyGirl = "lonely_girl",
  DemonHunter = "demon_hunter",
  PureWhiteGirl = "pure_white_girl",
  WolfWitch = "wolf_witch",
  EvilKnight = "evil_knight",
  NightmareShadow = "nightmare",
  RedMoonApostle = "red_moon_apostle",
  DayScholar = "day_scholar",
  NightMentor = "night_mentor",
  TimeWolfConsort = "time_wolf_consort",
  WolfSorcerer = "wolf_sorcerer",
  Trickster = "trickster",
  OrderPrince = "order_prince",
  Magician = "magician",
  GhostBride = "ghost_bride",
  HiddenWolf = "hidden_wolf",
  Gargoyle = "gargoyle",
  Psychic = "psychic",
  MirrorGirl = "mirror_girl",
  MechanicalWolf = "mechanical_wolf",
  AwakenedHiddenWolf = "awakened_hidden_wolf",
  MiracleMerchant = "miracle_merchant",
  BlackMarketMerchant = "black_market_merchant",
  Hybrid = "hybrid",
  Villager = "villager",
  Seer = "seer",
  Guard = "guard",
  Witch = "witch",
  Hunter = "hunter",
  Idiot = "idiot",
}

/** 原阶段标识及顺序保持；持有该值不推进时钟或打开某个具体窗口。 */
export enum Phase {
  Night = "night",
  Day = "day",
  Voting = "voting",
  GameOver = "game_over",
}

export enum ActionWindow {
  OnDaybreak = "on_daybreak",
  OnPreElection = "on_pre_election",
  OnPreVote = "on_pre_vote",
  OnPerSpeechGap = "on_per_speech_gap",
}
export enum KnightDuelWindow {
  BeforeSpeeches = "before_speeches",
  BetweenSpeeches = "between_speeches",
  AfterSpeeches = "after_speeches",
}

export enum StatusMark {
  GuardMark = "GuardMark",
  WolfKillMark = "WolfKillMark",
  HealMark = "HealMark",
  PoisonMark = "PoisonMark",
}

/** 胜利政策标识只描述选择的规则，实际赢家／独立成员关系／观察标签不是从枚举自动计算。 */
export enum WinCondition {
  ThreeFactionsElimination = "three_factions_elimination",
  SlaughterCity = "slaughter_city",
  SlaughterSide = "slaughter_side",
  WolfReachHalf = "wolf_reach_half",
}

export enum PotionType {
  Heal = "heal",
  Poison = "poison",
  None = "none",
}

export enum WitchSelfHealRule {
  Disabled = "disabled",
  FirstNightOnly = "first_night_only",
  Always = "always",
}

export type TieBreakerStrategy = "min_id" | "min_seat" | "no_elimination" | "no_kill";
