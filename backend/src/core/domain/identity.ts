import type { Locale } from "@ai-werewolf-arena/game-catalog";
/** Stable identity and phase enums shared by core domain consumers. */
export type EntityId = number;

export enum Camp {
  Good = "good",
  Wolf = "wolf",
  ThirdParty = "third_party",
}

export enum Role {
  Wolf = "wolf",
  WolfKing = "wolf_king",
  WhiteWolfKing = "white_wolf_king",
  Knight = "knight",
  Gravekeeper = "gravekeeper",
  Dreamer = "dreamer",
  WolfBeauty = "wolf_beauty",
  Bear = "bear",
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

export interface PromptRenderable {
  renderPrompt(locale?: Locale): string;
}
