import type { ActionWindow, KnightDuelWindow, Role, WinCondition, WitchSelfHealRule, TieBreakerStrategy } from "./identity";

export interface HookConfig {
  onDaybreak: boolean;
  onPreElection: boolean;
  onPreVote: boolean;
  onPerSpeechGap: boolean;
}

export interface SelfDestructConfig {
  enabledWindows: ActionWindow[];
}

export interface SheriffConfig {
  voteWeight?: number;
}

export interface WitchConfig {
  canSelfHeal?: WitchSelfHealRule;
}

export interface TieBreakerConfig {
  exileVote?: TieBreakerStrategy;
  wolfKillVote?: TieBreakerStrategy;
  sheriffVote?: TieBreakerStrategy;
}

export const GUARD_REPEAT_POLICIES = ["awa_last_action_v1", "netease_consecutive_nights_v1"] as const;
export type GuardRepeatPolicy = typeof GUARD_REPEAT_POLICIES[number];

export interface BoardConfig {
  boardSize: number;
  enableSheriff: boolean;
  initialSheriffSeat?: number;
  winConditions?: WinCondition[];
  winCondition?: WinCondition;
  hooks: HookConfig;
  selfDestruct?: SelfDestructConfig;
  sheriff?: SheriffConfig;
  witch?: WitchConfig;
  guard?: { repeatPolicy: GuardRepeatPolicy };
  knight?: { enabledWindows: KnightDuelWindow[] };
  tieBreaker?: TieBreakerConfig;
  roleSetups: Array<{ role: Role; count: number }>;
}
