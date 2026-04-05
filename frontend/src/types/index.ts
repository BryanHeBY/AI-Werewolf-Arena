/**
 * AI狼人杀竞技场 - 类型定义文件
 * 定义了游戏状态、玩家、动作等核心数据结构
 */

/**
 * 游戏阶段枚举
 * 描述狼人杀游戏的不同阶段流程
 */
export enum GamePhase {
  Night_Start = "Night_Start", // 夜晚开始
  Wolf_Action = "Wolf_Action", // 狼人行动阶段
  Seer_Action = "Seer_Action", // 预言家行动阶段
  Witch_Action = "Witch_Action", // 女巫行动阶段
  Day_Start = "Day_Start", // 白天开始
  Publish_Night_Result = "Publish_Night_Result", // 公布夜晚结果
  Sequential_Speech = "Sequential_Speech", // 顺序发言阶段
  Vote = "Vote", // 投票阶段
  Check_Win_Condition = "Check_Win_Condition", // 检查胜利条件
  Game_Over = "Game_Over", // 游戏结束
}

/**
 * 阵营枚举
 * 定义玩家的所属阵营，决定游戏目标和胜利条件
 */
export enum Faction {
  Wolf = "wolf", // 狼人阵营：目标是消灭所有村民
  Villager = "villager", // 村民阵营：目标是消灭所有狼人
}

/**
 * 角色类型枚举
 * 定义游戏中具体的角色类型，每个角色有特殊能力
 */
export enum RoleType {
  Wolf = "wolf", // 狼人：夜晚可以杀人
  Villager = "villager", // 普通村民：无特殊能力
  Seer = "seer", // 预言家：夜晚可以查验玩家身份
  Witch = "witch", // 女巫：有解药和毒药，可以救人或杀人
}

/**
 * 动作类型枚举
 * 定义玩家可以执行的各种游戏动作
 */
export enum ActionType {
  Kill = "kill", // 狼人杀人
  Save = "save", // 女巫救人（使用解药）
  Poison = "poison", // 女巫毒人（使用毒药）
  Check = "check", // 预言家查验
  Speak = "speak", // 玩家发言
  Vote = "vote", // 玩家投票
  Think = "think", // AI思考（内部推理过程）
}

/**
 * 玩家接口
 * 包含玩家的完整信息，包括私有信息（如具体角色）
 */
export interface Player {
  id: number; // 玩家唯一标识符
  name: string; // 玩家名称
  roleType: RoleType; // 玩家角色类型
  faction: Faction; // 玩家所属阵营
  isAlive: boolean; // 玩家是否存活
}

/**
 * 公开玩家信息接口
 * 用于向所有玩家公开的信息，不包含私有角色信息
 */
export interface PublicPlayer {
  id: number; // 玩家唯一标识符
  name: string; // 玩家名称
  faction: Faction; // 玩家所属阵营（可能未知，取决于游戏阶段）
  isAlive: boolean; // 玩家是否存活
}

/**
 * 公开游戏状态接口
 * 向所有玩家公开的游戏状态信息
 */
export interface PublicGameState {
  round: number; // 当前回合数
  phase: GamePhase; // 当前游戏阶段
  alivePlayers: PublicPlayer[]; // 存活玩家列表（公开信息）
  deadPlayers: PublicPlayer[]; // 死亡玩家列表
  nightResult: NightResult | null; // 夜晚行动结果
  voteResult: VoteResult | null; // 投票结果
  wolfCount: number; // 剩余狼人数量
  villagerCount: number; // 剩余村民数量
  isGameOver: boolean; // 游戏是否结束
  winner: Faction | null; // 获胜阵营（游戏结束时）
}

/**
 * 玩家动作接口
 * 记录玩家在游戏中的每一次动作
 */
export interface PlayerAction {
  playerId: number; // 执行动作的玩家ID
  actionType: ActionType; // 动作类型
  targetId: number | null; // 目标玩家ID（如杀人、查验等动作的目标）
  timestamp: number; // 动作时间戳
  content?: string; // 动作内容（如发言内容）
  privateThought?: string; // AI玩家的私有思考过程
}

/**
 * 夜晚结果接口
 * 记录夜晚阶段所有角色的行动结果
 */
export interface NightResult {
  killedByWolf: number | null; // 被狼人杀死的玩家ID（null表示无人死亡）
  savedByWitch: boolean; // 女巫是否使用解药救人
  poisonedByWitch: number | null; // 被女巫毒死的玩家ID
  checkedBySeer: CheckResult | null; // 预言家的查验结果
  deadPlayerIds: number[]; // 本夜最终死亡的玩家ID列表
}

/**
 * 查验结果接口
 * 预言家查验玩家身份的结果
 */
export interface CheckResult {
  playerId: number; // 被查验的玩家ID
  faction: Faction; // 查验到的玩家阵营（预言家只能看到阵营，不能看到具体角色）
}

/**
 * 投票结果接口
 * 记录投票阶段的投票结果
 */
export interface VoteResult {
  votedPlayerId: number | null; // 被投票出局的玩家ID（null表示无人出局）
  voteCounts: Record<number, number>; // 每个玩家获得的票数记录
  isTie: boolean; // 是否平票
}

/**
 * AI模型配置接口
 * 配置AI玩家使用的语言模型参数
 */
export interface ModelConfig {
  baseUrl: string; // API基础URL
  apiKey: string; // API密钥
  model: string; // 模型名称
  temperature: number; // 温度参数，控制生成随机性
  maxTokens: number; // 最大生成token数
}

/**
 * 完整游戏状态接口
 * 包含游戏的所有状态信息，包括私有信息
 */
export interface GameState {
  round: number; // 当前回合数
  phase: GamePhase; // 当前游戏阶段
  alivePlayers: Player[]; // 存活玩家列表（完整信息）
  deadPlayers: Player[]; // 死亡玩家列表（完整信息）
  history: PlayerAction[]; // 游戏历史动作记录
  nightResult: NightResult | null; // 夜晚行动结果
  voteResult: VoteResult | null; // 投票结果
  wolfCount: number; // 剩余狼人数量
  villagerCount: number; // 剩余村民数量
  isGameOver: boolean; // 游戏是否结束
  winner: Faction | null; // 获胜阵营
}

/**
 * OODA循环接口
 * 用于AI玩家的决策过程：观察-定向-决策-行动
 */
export interface OODACycle {
  observe: string; // 观察阶段：收集游戏信息
  orient: string; // 定向阶段：分析当前形势
  decide: string; // 决策阶段：制定行动计划
  act: string; // 行动阶段：执行决策
}

/**
 * 聊天消息接口
 * 记录游戏中的聊天消息
 */
export interface ChatMessage {
  id: number; // 消息唯一标识符
  senderId: number; // 发送者玩家ID
  content: string; // 消息内容
  timestamp: number; // 发送时间戳
  isPrivate: boolean; // 是否为私聊消息
  privateThought?: string; // AI玩家的私有思考（仅自己可见）
}
