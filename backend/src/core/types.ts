/**
 * 游戏阶段枚举
 * 严格按照状态机流转顺序定义
 * V2新增：上警、PK、狼人自爆等阶段
 */
export enum GamePhase {
  // V1原有阶段
  NightStart = "Night_Start",
  WolfAction = "Wolf_Action",
  SeerAction = "Seer_Action",
  WitchAction = "Witch_Action",
  DayStart = "Day_Start",
  PublishNightResult = "Publish_Night_Result",
  SequentialSpeech = "Sequential_Speech",
  Vote = "Vote",
  CheckWinCondition = "Check_Win_Condition",
  GameOver = "Game_Over",

  // V2新增阶段
  Sheriff_Run = "Sheriff_Run", // 决定是否上警
  Sheriff_Speech = "Sheriff_Speech", // 上警发言
  Sheriff_Vote = "Sheriff_Vote", // 警长投票
  PK_Speech = "PK_Speech", // PK发言
  Self_Destruct = "Self_Destruct", // 狼人自爆
}

/**
 * 阵营枚举
 */
export enum Faction {
  Wolf = "wolf",
  Villager = "villager",
}

/**
 * 角色身份枚举
 */
export enum RoleType {
  Wolf = "wolf",
  Villager = "villager",
  Seer = "seer",
  Witch = "witch",
}

/**
 * 动作类型枚举
 * V2新增：狼人自爆、上警相关动作
 */
export enum ActionType {
  Kill = "kill", // 狼人杀人
  Save = "save", // 女巫解药救人
  Poison = "poison", // 女巫毒药杀人
  Check = "check", // 预言家查验
  Speak = "speak", // 公开发言
  Vote = "vote", // 投票放逐
  NoAction = "no_action", // 不行动

  // V2新增动作
  SelfDestruct = "self_destruct", // 狼人自爆
  SheriffRun = "sheriff_run", // 上警竞选
  SheriffVote = "sheriff_vote", // 警长投票
}

/**
 * LLM 输出结构
 */
export interface AgentOutput {
  thought: string; // 内心独白/推理过程（对旁观者可见）
  action: {
    type: ActionType;
    targetId?: number; // 目标玩家ID
    content?: string; // 发言内容
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
  thought: string; // 思考过程（用于日志和广播）
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
  isSheriff?: boolean; // V2新增：是否警长
}

/**
 * 公开玩家信息 - 用于广播和日志（不含敏感信息）
 */
export interface PublicPlayer {
  id: number;
  name: string;
  roleType?: RoleType;
  faction?: Faction;
  isAlive: boolean;
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
  // V2新增：Phase Stack信息，用于前端显示阶段流转
  phaseStack: StackNode[];
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
  killedByWolf?: number; // 狼人刀的人
  savedByWitch?: number; // 被女巫救的人
  poisonedByWitch?: number; // 被女巫毒的人
}

/**
 * 预言家查验结果
 */
export interface CheckResult {
  targetId: number;
  isWolf: boolean;
}

/**
 * 聊天消息结构 - 用于前后端通信
 */
export interface ChatMessage {
  id: string;
  type: "speak" | "action" | "system";
  playerId?: number;
  playerName?: string;
  content: string;
  privateThought?: string;
  timestamp: number;
}

/**
 * 广播事件类型
 */
export enum BroadcastEventType {
  GameStarted = "game_started",
  PhaseChanged = "phase_changed",
  AgentThinking = "agent_thinking",
  AgentThoughtComplete = "agent_thought_complete",
  PlayerAction = "player_action",
  NightResult = "night_result",
  PlayerDied = "player_died",
  SpeechStart = "speech_start",
  VoteResult = "vote_result",
  GameOver = "game_over",
  WinnerDeclared = "winner_declared",
}

/**
 * 广播消息结构
 * 所有前端需要的实时更新都通过这个结构推送
 */
export interface BroadcastEvent {
  type: BroadcastEventType;
  data: unknown;
  timestamp: number;
  gameStateForView?: GameState;
}

/**
 * GameState 结构 - 游戏的核心状态
 * 作为 Single Source of Truth
 */
export interface GameState {
  phase: GamePhase;
  round: number; // 第几轮（天数）
  players: Player[];
  deadPlayerIds: number[];
  history: PlayerAction[];
  nightResult?: NightResult;
  lastChecked?: CheckResult; // 预言家最近一次查验结果
  votedDeadId?: number; // 本轮投票出局的人
  winner?: Faction;
  // 女巫特殊状态
  witchHasAntidote: boolean;
  witchHasPoison: boolean;
  // 当前要行动的玩家索引（用于顺序发言）
  currentSpeechIndex: number;
  // V2新增：Phase Stack支持嵌套、并发阶段
  phaseStack: StackNode[];
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
import type { Environment } from "./Environment";
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

// ============================================================================
// V2 新增类型定义 - Event-Driven ECS + Phase Stack 架构
// ============================================================================

/**
 * Phase Stack 节点
 * V2核心数据结构，用于支持嵌套、并发的游戏阶段
 */
export interface StackNode {
  phase: GamePhase;
  context?: Record<string, any>; // 阶段上下文，如平票PK的参与者
}

/**
 * 实体ID类型
 * ECS架构中的唯一标识符
 */
export type EntityId = number;

/**
 * 实体接口
 * ECS架构中的基本单位，只包含ID
 */
export interface Entity {
  id: EntityId;
}

/**
 * 组件基类接口
 * ECS架构中的纯数据容器，不包含逻辑
 */
export interface Component {
  entityId: EntityId;
}

/**
 * 身份组件
 * 包含角色的身份信息
 */
export interface IdentityComponent extends Component {
  roleType: RoleType;
  faction: Faction;
  name: string;
}

/**
 * 状态组件
 * 包含角色的状态信息
 */
export interface StatusComponent extends Component {
  isAlive: boolean;
  isSheriff: boolean;
  isMuted: boolean; // 禁言状态
  muteUntilRound?: number; // 禁言直到第几轮
}

/**
 * 技能接口
 * 定义可执行的技能
 */
export interface Skill {
  skillId: string;
  name: string;
  cooldown: number; // 剩余冷却回合数
  canUseInPhase: GamePhase[]; // 可在哪些阶段使用
  execute: (entityId: EntityId, targetId?: EntityId) => void;
}

/**
 * 技能组件
 * 包含实体拥有的技能列表
 */
export interface SkillComponent extends Component {
  skills: Skill[];
}

/**
 * 系统接口
 * ECS架构中的逻辑处理器
 */
export interface System {
  update(phase: GamePhase, entities: Entity[]): void;
}

/**
 * 世界接口
 * 管理所有实体、组件和系统
 */
export interface World {
  createEntity(): EntityId;
  addComponent<T extends Component>(entityId: EntityId, component: T): void;
  removeComponent(entityId: EntityId, componentType: string): void;
  getComponent<T extends Component>(
    entityId: EntityId,
    componentType: string,
  ): T | null;
  getEntitiesWithComponent(componentType: string): EntityId[];
  registerSystem(system: System): void;
  update(phase: GamePhase): void;
}
