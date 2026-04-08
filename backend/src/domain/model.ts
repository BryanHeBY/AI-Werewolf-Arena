/**
 * V3 引擎的核心领域类型定义。
 * 这里是全局共享的“协议层”，包含阶段、角色、工具调用、事件与运行时快照等基础类型。
 */
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
  // 天亮后、白天发言前的中断窗口。
  OnDaybreak = "on_daybreak",
  // 警上发言后、警长相关流程前的中断窗口。
  OnPreElection = "on_pre_election",
  // 放逐投票前的中断窗口。
  OnPreVote = "on_pre_vote",
  // 每个玩家发言结束后的中断窗口（高压配置）。
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
  // 板子规模（玩家总数）。
  boardSize: number;
  // 是否在死亡时公开身份。
  revealOnDeath: boolean;
  // 是否启用警长系统。
  enableSheriff: boolean;
  initialSheriffSeat?: number;
  winCondition: WinCondition;
  hooks: HookConfig;
  // 每种角色的数量配置，启动时会展开为底牌牌堆。
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
  // 当前阶段（夜晚/白天/投票）。
  phase: Phase;
  // 可选动作窗口，用于限制如自爆等中断行为。
  actionWindow?: ActionWindow;
  actorId: EntityId;
  // 当前回合允许调用的工具集合，防止模型越权行动。
  allowedTools: ToolName[];
  // 按阶段注入的上下文信息（如 wolf_target、window、trigger）。
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
