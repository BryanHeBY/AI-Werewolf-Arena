/**
 * V3 引擎的核心领域类型定义。
 * 这里是全局共享的“协议层”，包含阶段、角色、工具调用、事件与运行时快照等基础类型。
 */
export type EntityId = number;

/**
 * 玩家阵营定义。
 */
export enum Camp {
  Good = "good",
  Wolf = "wolf",
  ThirdParty = "third_party",
}

/**
 * 角色底牌定义。
 */
export enum Role {
  Wolf = "wolf",
  Villager = "villager",
  Seer = "seer",
  Guard = "guard",
  Witch = "witch",
  Hunter = "hunter",
  Idiot = "idiot",
}

/**
 * 对局主阶段定义。
 */
export enum Phase {
  Night = "night",
  Day = "day",
  Voting = "voting",
  GameOver = "game_over",
}

/**
 * 白天中断窗口定义。
 */
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

/**
 * 夜间临时状态印记定义。
 */
export enum StatusMark {
  GuardMark = "GuardMark",
  WolfKillMark = "WolfKillMark",
  HealMark = "HealMark",
  PoisonMark = "PoisonMark",
}

/**
 * 胜利条件模式定义。
 */
export enum WinCondition {
  SlaughterCity = "slaughter_city",
  SlaughterSide = "slaughter_side",
}

/**
 * 女巫药剂类型定义。
 */
export enum PotionType {
  Heal = "heal",
  Poison = "poison",
  None = "none",
}

/**
 * 中断钩子开关配置。
 */
export interface HookConfig {
  onDaybreak: boolean;
  onPreElection: boolean;
  onPreVote: boolean;
  onPerSpeechGap: boolean;
}

/**
 * 板子配置模型。
 */
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

/**
 * 可渲染到 Prompt 的组件接口。
 */
export interface PromptRenderable {
  renderPrompt(): string;
}

/**
 * 工具参数映射定义。
 */
export interface ToolArgMap {
  speak_to_wolves: { text: string; end_chat: boolean };
  kill_vote: { target_id: EntityId | null; abstain: boolean };
  guard: { target_id: EntityId | null; abstain: boolean };
  check_identity: { target_id: EntityId };
  use_potion: { target_id: EntityId; potion_type: PotionType };
  self_destruct: { reason: string };
  speak: { text: string };
  vote: { target_id: EntityId | null; abstain: boolean };
  shoot: { target_id: EntityId };
  choose_direction: { direction: "clockwise" | "counter_clockwise" };
  run_for_sheriff: { run: boolean };
  vote_for_sheriff: { target_id: EntityId | null; abstain: boolean };
}

/**
 * 工具名联合类型。
 */
export type ToolName = keyof ToolArgMap;

/**
 * 工具调用联合类型。
 */
export type ToolCall = {
  [K in ToolName]: { name: K; args: ToolArgMap[K] };
}[ToolName];

/**
 * 按工具名收窄的工具调用类型。
 */
export type TypedToolCall<T extends ToolName> = Extract<ToolCall, { name: T }>;

/**
 * 工具参数校验结果。
 */
export interface ToolValidationResult<T extends ToolCall = ToolCall> {
  ok: boolean;
  sanitizedCall?: T;
  error?: string;
}

/**
 * 行动请求上下文。
 */
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
  // 当前整局运行的绝对截止时间（毫秒时间戳），用于动作级超时预算控制。
  deadlineAtMs?: number;
}

/**
 * 行动提供器接口。
 */
export interface ActionProvider {
  getAction(request: ActionRequest): Promise<ToolCall | null>;
}

/**
 * 对局事件结构。
 */
export interface GameEvent {
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * 终局结果结构。
 */
export interface GameResult {
  winner: Camp | null;
  reason: string;
}

/**
 * 预言家查验结果结构。
 */
export interface SeerCheckResult {
  seerId: EntityId;
  targetId: EntityId;
  isWerewolf: boolean;
}

/**
 * 夜间阶段结算摘要。
 */
export interface NightSummary {
  wolfTarget: EntityId | null;
  deaths: EntityId[];
  seerChecks: SeerCheckResult[];
  interruptedBySelfDestruct: boolean;
}

/**
 * 白天阶段摘要。
 */
export interface DaySummary {
  speeches: Array<{ actorId: EntityId; text: string }>;
  selfDestructBy: EntityId | null;
}

/**
 * 投票阶段摘要。
 */
export interface VotingSummary {
  tally: Record<number, number>;
  target: EntityId | null;
  removed: EntityId[];
}

/**
 * 运行时快照结构。
 */
export interface RuntimeSnapshot {
  day: number;
  phase: Phase;
  gameOver: boolean;
  result: GameResult | null;
}
