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
}

export enum PotionType {
  Heal = "heal",
  Poison = "poison",
  None = "none",
}

export interface HookConfig {
  onDaybreak: boolean;
  onPreElection: boolean;
  onPreVote: boolean;
  onPerSpeechGap: boolean;
}

export interface BoardConfig {
  boardSize: number;
  revealOnDeath: boolean;
  enableSheriff: boolean;
  initialSheriffSeat?: number;
  winCondition: WinCondition;
  hooks: HookConfig;
  roleSetups: Array<{ role: Role; count: number }>;
}

export interface PromptRenderable {
  renderPrompt(): string;
}

export interface ToolArgMap {
  speak_to_wolves: { text: string };
  kill_vote: { target_id: EntityId };
  guard: { target_id: EntityId };
  check_identity: { target_id: EntityId };
  use_potion: { target_id: EntityId; potion_type: PotionType };
  self_destruct: { reason: string };
  speak: { text: string };
  vote: { target_id: EntityId };
  shoot: { target_id: EntityId };
  choose_direction: { direction: "clockwise" | "counter_clockwise" };
}

export type ToolName = keyof ToolArgMap;

export type ToolCall = {
  [K in ToolName]: { name: K; args: ToolArgMap[K] };
}[ToolName];

export type TypedToolCall<T extends ToolName> = Extract<ToolCall, { name: T }>;

export interface ToolValidationResult<T extends ToolCall = ToolCall> {
  ok: boolean;
  sanitizedCall?: T;
  error?: string;
}

export interface ActionRequest {
  phase: Phase;
  actionWindow?: ActionWindow;
  actorId: EntityId;
  allowedTools: ToolName[];
  context: Record<string, unknown>;
}

export interface ActionProvider {
  getAction(request: ActionRequest): Promise<ToolCall | null>;
}

export interface GameEvent {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface GameResult {
  winner: Camp | null;
  reason: string;
}

export interface SeerCheckResult {
  seerId: EntityId;
  targetId: EntityId;
  isWerewolf: boolean;
}

export interface NightSummary {
  wolfTarget: EntityId | null;
  deaths: EntityId[];
  seerChecks: SeerCheckResult[];
  interruptedBySelfDestruct: boolean;
}

export interface DaySummary {
  speeches: Array<{ actorId: EntityId; text: string }>;
  selfDestructBy: EntityId | null;
}

export interface VotingSummary {
  tally: Record<number, number>;
  target: EntityId | null;
  removed: EntityId[];
}

export interface RuntimeSnapshot {
  day: number;
  phase: Phase;
  gameOver: boolean;
  result: GameResult | null;
}
