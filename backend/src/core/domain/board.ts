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
  knight?: { enabledWindows: KnightDuelWindow[] };
  tieBreaker?: TieBreakerConfig;
  roleSetups: Array<{ role: Role; count: number }>;
}
