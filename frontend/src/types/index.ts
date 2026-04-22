/**
 * 游戏阶段枚举
 * 严格按照状态机流转顺序定义
 */
export enum GamePhase {
  NightStart = 'Night_Start',
  WolfAction = 'Wolf_Action',
  SeerAction = 'Seer_Action',
  WitchAction = 'Witch_Action',
  DayStart = 'Day_Start',
  PublishNightResult = 'Publish_Night_Result',
  SequentialSpeech = 'Sequential_Speech',
  Vote = 'Vote',
  CheckWinCondition = 'Check_Win_Condition',
  GameOver = 'Game_Over'
}

/**
 * 阵营枚举
 */
export enum Faction {
  Wolf = 'wolf',
  Villager = 'villager'
}

/**
 * 角色身份枚举
 */
export enum RoleType {
  Wolf = 'wolf',
  Villager = 'villager',
  Seer = 'seer',
  Witch = 'witch',
  Guard = 'guard',
  Hunter = 'hunter',
  Idiot = 'idiot'
}

/**
 * 动作类型枚举
 */
export enum ActionType {
  Kill = 'kill',          // 狼人杀人
  Save = 'save',          // 女巫解药救人
  Poison = 'poison',      // 女巫毒药杀人
  Check = 'check',        // 预言家查验
  Speak = 'speak',        // 公开发言
  Vote = 'vote',          // 投票放逐
  NoAction = 'no_action'  // 不行动
}

/**
 * LLM 输出结构
 */
export interface AgentOutput {
  thought: string;      // 内心独白/推理过程（对旁观者可见）
  action: {
    type: ActionType;
    targetId?: number;  // 目标玩家ID
    content?: string;   // 发言内容
  };
}

/**
 * 玩家动作记录
 */
export interface PlayerAction {
  playerId: number;
  roleType: RoleType;
  actionType: ActionType;
  targetId?: number;
  content?: string;
  thought: string;      // 思考过程（用于日志和广播）
  timestamp: number;
}

/**
 * 玩家信息结构 (internal - contains model config and role instance)
 */
export interface Player {
  id: number;
  name: string;
  role: Role;
  isAlive: boolean;
  faction: Faction;
  modelConfig: ModelConfig;
}

/**
 * 公开玩家信息 - 用于广播和日志（不含敏感信息）
 */
export interface PublicPlayer {
  id: number;
  name: string;
  roleType: RoleType;
  faction: Faction;
  isAlive: boolean;
  isSheriff?: boolean;
  voteWeight?: number;
}

/**
 * 公开游戏状态 - 用于广播和日志（不含敏感信息和循环引用）
 */
export interface PublicGameState {
  phase: GamePhase;
  round: number;
  players: PublicPlayer[];
  deadPlayerIds: number[];
  history: PlayerAction[];
  nightResult?: NightResult;
  votedDeadId?: number;
  winner?: Faction;
  witchHasAntidote: boolean;
  witchHasPoison: boolean;
  currentSpeechIndex: number;
  alive_count?: number;
  pending_marks?: Array<{ playerId: number; marks: string[] }>;
  last_action_id?: string;
  interrupt_state?: {
    interrupted: boolean;
    window?: string;
    by?: number | null;
  };
  sheriff?: {
    id: number | null;
    voteWeight: number;
  };
}


/**
 * LLM 模型配置
 * 支持每个玩家配置不同的模型
 */
export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * 游戏配置
 */
export interface GameConfig {
  totalPlayers: number;
  wolfCount: number;
  villagerCount: number;
  seerCount: number;
  witchCount: number;
  modelDefaults: ModelConfig;
}

/**
 * 夜晚结果信息
 */
export interface NightResult {
  deadPlayerIds: number[];
  killedByWolf?: number;      // 狼人刀的人
  savedByWitch?: number;      // 被女巫救的人
  poisonedByWitch?: number;    // 被女巫毒的人
}

/**
 * 预言家查验结果
 */
export interface CheckResult {
  targetId: number;
  isWolf: boolean;
}

/**
 * 广播事件类型
 */
export enum BroadcastEventType {
  GameStarted = 'game_started',
  PhaseChanged = 'phase_changed',
  AgentThinking = 'agent_thinking',
  AgentThoughtComplete = 'agent_thought_complete',
  PlayerAction = 'player_action',
  NightResult = 'night_result',
  PlayerDied = 'player_died',
  SpeechStart = 'speech_start',
  VoteResult = 'vote_result',
  GameOver = 'game_over',
  WinnerDeclared = 'winner_declared'
}

/**
 * 广播消息结构
 * 所有前端需要的实时更新都通过这个结构推送
 */
export interface BroadcastEvent {
  type: BroadcastEventType;
  data: unknown;
  timestamp: number;
}

/**
 * `game_started` 事件载荷：用于首屏初始化玩家与回合信息。
 */
export interface GameStartedPayload {
  phase: GamePhase | string;
  round: number;
  players: PublicPlayer[];
  gameState?: PublicGameState;
}

/**
 * `phase_changed` 事件载荷：描述阶段流转与可选的中断状态。
 */
export interface PhaseChangedPayload {
  phase: GamePhase | string;
  round: number;
  gameState?: PublicGameState;
  interrupted?: boolean;
  interruptWindow?: string;
  interruptedBy?: number | null;
}

/**
 * `agent_thinking` 事件载荷：展示某玩家的思考文本。
 */
export interface AgentThinkingPayload {
  playerId: number;
  thought: string;
}

/**
 * `player_action` 事件载荷：统一封装发言/投票/夜间动作。
 */
export interface PlayerActionPayload {
  playerId: number;
  roleType?: RoleType | string;
  actionType: ActionType | string;
  targetId?: number;
  content?: string;
  thought?: string;
}

/**
 * `night_result` 事件载荷：汇总夜间死亡与女巫干预结果。
 */
export interface NightResultPayload {
  deadPlayerIds: number[];
  killedByWolf?: number;
  savedByWitch?: number;
  poisonedByWitch?: number;
}

/**
 * `player_died` 事件载荷：用于前端标记出局玩家。
 */
export interface PlayerDiedPayload {
  playerId: number;
  roleType?: RoleType | string;
}

/**
 * `speech_start` 事件载荷：标识当前轮到哪位玩家发言。
 */
export interface SpeechStartPayload {
  playerId?: number;
  playerName?: string;
}

/**
 * `vote_result` 事件载荷：兼容不同字段名的放逐结果。
 */
export interface VoteResultPayload {
  votedDeadId?: number;
  votedDeadName?: string;
  votedOutId?: number;
  votedOutName?: string;
}

/**
 * `game_over` 事件载荷：包含胜负阵营与可选最终状态快照。
 */
export interface GameOverPayload {
  winner: Faction | string;
  gameState?: PublicGameState;
}

/**
 * `winner_declared` 事件载荷：用于展示文案化胜利公告。
 */
export interface WinnerDeclaredPayload {
  winner: Faction | string;
  message?: string;
}

/**
 * WebSocket 实时事件联合类型，前端消费端按 `type` 分发。
 */
export type RealtimeGameEvent =
  | { type: BroadcastEventType.GameStarted; data: GameStartedPayload; timestamp: number }
  | { type: BroadcastEventType.PhaseChanged; data: PhaseChangedPayload; timestamp: number }
  | { type: BroadcastEventType.AgentThinking; data: AgentThinkingPayload; timestamp: number }
  | { type: BroadcastEventType.AgentThoughtComplete; data: AgentThinkingPayload; timestamp: number }
  | { type: BroadcastEventType.PlayerAction; data: PlayerActionPayload; timestamp: number }
  | { type: BroadcastEventType.NightResult; data: NightResultPayload; timestamp: number }
  | { type: BroadcastEventType.PlayerDied; data: PlayerDiedPayload; timestamp: number }
  | { type: BroadcastEventType.SpeechStart; data: SpeechStartPayload; timestamp: number }
  | { type: BroadcastEventType.VoteResult; data: VoteResultPayload; timestamp: number }
  | { type: BroadcastEventType.GameOver; data: GameOverPayload; timestamp: number }
  | { type: BroadcastEventType.WinnerDeclared; data: WinnerDeclaredPayload; timestamp: number };

/**
 * GameState 结构 - 游戏的核心状态
 * 作为 Single Source of Truth
 */
export interface GameState {
  phase: GamePhase;
  round: number;  // 第几轮（天数）
  players: Player[];
  deadPlayerIds: number[];
  history: PlayerAction[];
  nightResult?: NightResult;
  lastChecked?: CheckResult;  // 预言家最近一次查验结果
  votedDeadId?: number;        // 本轮投票出局的人
  winner?: Faction;
  // 女巫特殊状态
  witchHasAntidote: boolean;
  witchHasPoison: boolean;
  // 当前要行动的玩家索引（用于顺序发言）
  currentSpeechIndex: number;
}

/**
 * EventBus 事件处理器类型
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * OODA Loop 接口 - 每个 Agent 都必须遵循
 */
export interface OODACycle {
  observe(env: Environment): Promise<void>;
  think(): Promise<string>;
  act(): Promise<PlayerAction>;
}

/**
 * Environment 公共黑板接口
 */
import type { Environment } from './Environment';
/**
 * 环境接口别名：统一前后端共享的 Environment 类型命名。
 */
export type EnvironmentInterface = Environment;

/**
 * Role 基类接口
 */
export interface Role extends OODACycle {
  roleType: RoleType;
  faction: Faction;
  playerId: number;
  canActInPhase(phase: GamePhase): boolean;
  getSystemPrompt(): string;
}
