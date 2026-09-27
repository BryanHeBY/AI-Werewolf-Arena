/** Stable identity and phase enums shared by core domain consumers. */
export type EntityId = number;

export enum Camp {
  Good = "good",
  Wolf = "wolf",
  ThirdParty = "third_party",
}

export enum Role {
  Wolf = "wolf",
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

export enum StatusMark {
  GuardMark = "GuardMark",
  WolfKillMark = "WolfKillMark",
  HealMark = "HealMark",
  PoisonMark = "PoisonMark",
}

export enum WinCondition {
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
  renderPrompt(): string;
}
