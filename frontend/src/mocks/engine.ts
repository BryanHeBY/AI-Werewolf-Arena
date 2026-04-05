// 导入类型定义和游戏状态管理
import type { ChatMessage } from "@/types/v2-types";
import { useGameStore } from "@/stores/gameStore";

/**
 * Mock引擎 - AI狼人杀竞技场的模拟数据引擎
 * 架构设计：单例模式，提供模拟游戏数据用于开发和测试
 * 主要功能：
 * 1. 模拟游戏状态初始化
 * 2. 生成随机的聊天消息
 * 3. 模拟系统事件和玩家行动
 * 4. 与游戏状态存储进行交互
 */

// 模拟玩家数据 - 固定的6名玩家配置
const MOCK_PLAYERS = [
  { id: 1, name: "Player 1" },
  { id: 2, name: "Player 2" },
  { id: 3, name: "Player 3" },
  { id: 4, name: "Player 4" },
  { id: 5, name: "Player 5" },
  { id: 6, name: "Player 6" },
];

// 正常发言内容池 - 模拟玩家公开发言
const NORMAL_SPEAK_CONTENTS = [
  "我是好人，大家相信我！",
  "我觉得Player 1可能是狼人",
  "昨晚Player 3死了，我认为...",
  "大家一起投票投Player 5",
  "我同意Player 2的说法",
  "暂时没有线索，先观察一下",
  "Player 4的发言很奇怪",
  "我认为应该先投Player 6",
  "我是村民，请大家相信我",
  "大家都冷静分析一下",
];

// 系统消息内容池 - 模拟游戏系统公告
const SYSTEM_MESSAGES = [
  "夜晚开始，请狼人选择目标",
  "预言家请选择要查验的玩家",
  "女巫可以选择使用解药或毒药",
  "天亮了，昨晚是平安夜",
  "昨晚Player 3被杀了",
  "请所有存活玩家按顺序发言",
  "投票阶段开始，请选择要放逐的玩家",
  "投票结果：Player 5被放逐",
  "游戏结束，村民胜利！",
  "狼人胜利！",
];

// 内心独白内容池 - 模拟AI玩家的心理活动
const PRIVATE_THOUGHTS = [
  "Player 1的发言很可疑，但我不确定，先观察一下...",
  "根据之前的发言，Player 2和Player 4可能是狼人队友...",
  "如果我是狼人，我会选择杀Player 3...",
  "女巫应该还持有解药，可能需要等待时机...",
  "预言家昨晚查验了Player 6，他是好人...",
  "投票给Player 5应该比较安全...",
  "局势对狼人有利，继续潜伏...",
  "村民阵营需要团结起来找出狼人...",
  "这个游戏的策略需要更加谨慎...",
  "内心独白：其实我早就知道真相了...",
];

// 行动描述内容池 - 模拟玩家执行的各种游戏行动
const ACTION_CONTENTS = [
  "决定投票给Player 5",
  "使用解药救自己",
  "使用毒药杀Player 3",
  "查验Player 2的身份",
  "选择击杀Player 4",
  "放弃使用技能",
  "提名Player 6进行投票",
];

/**
 * Mock引擎类 - 模拟游戏数据生成器
 * 设计模式：单例模式（通过getMockEngine函数实现）
 * 主要职责：
 * 1. 生成模拟的游戏状态
 * 2. 定期发送模拟的聊天消息
 * 3. 与Vuex/Pinia状态管理集成
 * 4. 提供启动/停止控制
 */
export class MockEngine {
  // 定时器ID，用于控制模拟消息生成间隔
  private intervalId: ReturnType<typeof setInterval> | null = null;
  // 游戏状态存储引用，用于更新前端状态
  private store: ReturnType<typeof useGameStore>;
  // 消息计数器，用于生成唯一的消息ID
  private messageCount = 0;
  // 引擎运行状态标志
  private isRunning = false;

  /**
   * 构造函数 - 初始化Mock引擎
   * 主要任务：获取游戏状态存储实例
   */
  constructor() {
    this.store = useGameStore();
  }

  /**
   * 初始化游戏状态 - 创建模拟的游戏初始状态
   * 业务逻辑：设置标准的6人狼人杀游戏配置
   * 角色分配：2狼人、1预言家、1女巫、2村民
   * 游戏状态：从夜晚开始，第一轮
   */
  private initializeGameState(): void {
    // 创建初始游戏状态对象
    const initialGameState = {
      // 当前游戏阶段：夜晚开始
      phase: "Night_Start" as const,
      // 当前游戏轮次：第一轮
      round: 1,
      // 玩家列表：包含6名玩家，分配不同角色
      players: [
        {
          id: 1,
          name: "Player 1",
          isAlive: true,
          roleType: "wolf" as const, // 狼人角色
          faction: "wolf" as const, // 狼人阵营
        },
        {
          id: 2,
          name: "Player 2",
          isAlive: true,
          roleType: "seer" as const, // 预言家角色
          faction: "villager" as const, // 村民阵营
        },
        {
          id: 3,
          name: "Player 3",
          isAlive: true,
          roleType: "villager" as const, // 村民角色
          faction: "villager" as const, // 村民阵营
        },
        {
          id: 4,
          name: "Player 4",
          isAlive: true,
          roleType: "wolf" as const, // 狼人角色
          faction: "wolf" as const, // 狼人阵营
        },
        {
          id: 5,
          name: "Player 5",
          isAlive: true,
          roleType: "witch" as const, // 女巫角色
          faction: "villager" as const, // 村民阵营
        },
        {
          id: 6,
          name: "Player 6",
          isAlive: true,
          roleType: "villager" as const, // 村民角色
          faction: "villager" as const, // 村民阵营
        },
      ],
      // 死亡玩家ID列表：初始为空
      deadPlayerIds: [],
      // 游戏历史记录：初始为空
      history: [],
      // 女巫技能状态：初始拥有解药和毒药
      witchHasAntidote: true,
      witchHasPoison: true,
      // 当前发言索引：从第一个玩家开始
      currentSpeechIndex: 0,
      // 阶段堆栈：用于管理阶段转换
      phaseStack: [],
    };

    // 更新游戏状态存储
    this.store.updateGameState(initialGameState);
    console.log(
      "[MockEngine] Initial game state injected with",
      initialGameState.players.length,
      "players",
    );
  }

  /**
   * 启动Mock引擎 - 开始模拟数据生成
   * 执行流程：
   * 1. 检查引擎是否已在运行
   * 2. 设置运行状态标志
   * 3. 更新连接状态
   * 4. 初始化游戏状态
   * 5. 启动定时器生成模拟消息
   */
  start(): void {
    // 检查引擎是否已在运行，避免重复启动
    if (this.isRunning) {
      console.warn("[MockEngine] Already running");
      return;
    }

    console.log("[MockEngine] Starting mock engine...");
    this.isRunning = true;
    // 更新前端连接状态，表示已连接到模拟引擎
    this.store.updateConnectionStatus(true);

    // 首先初始化游戏状态，确保有基础的游戏数据
    this.initializeGameState();

    // 然后启动定时器，每2秒生成一条模拟消息
    // 使用setInterval实现周期性消息生成
    this.intervalId = setInterval(() => {
      this.generateMockMessage();
    }, 2000);
  }

  /**
   * 停止Mock引擎 - 结束模拟数据生成
   * 执行流程：
   * 1. 检查引擎是否在运行
   * 2. 清除定时器，停止消息生成
   * 3. 重置运行状态标志
   * 4. 更新连接状态为断开
   */
  stop(): void {
    // 检查引擎是否在运行，避免不必要的停止操作
    if (!this.isRunning) {
      console.warn("[MockEngine] Not running");
      return;
    }

    console.log("[MockEngine] Stopping mock engine...");
    this.isRunning = false;

    // 清除定时器，停止周期性消息生成
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // 更新前端连接状态，表示已断开连接
    this.store.updateConnectionStatus(false);
  }

  /**
   * 生成模拟消息 - 核心消息生成方法
   * 执行流程：
   * 1. 创建随机类型的消息
   * 2. 将消息添加到游戏状态存储
   * 3. 更新消息计数器
   * 4. 记录日志
   */
  private generateMockMessage(): void {
    // 创建随机类型的消息（正常发言、系统消息、内心独白或行动）
    const message = this.createRandomMessage();
    // 将消息添加到前端的游戏状态存储，触发UI更新
    this.store.addChatMessage(message);
    // 增加消息计数，用于生成唯一的消息ID
    this.messageCount++;
    // 记录日志，便于调试和监控
    console.log(
      `[MockEngine] Message #${this.messageCount} sent:`,
      message.type,
    );
  }

  /**
   * 创建随机消息 - 根据概率分布选择消息类型
   * 概率分布设计：
   * - 正常发言：50% (0.0-0.5)
   * - 系统消息：20% (0.5-0.7)
   * - 内心独白：20% (0.7-0.9)
   * - 行动消息：10% (0.9-1.0)
   * 这种分布模拟真实游戏中的消息频率
   */
  private createRandomMessage(): ChatMessage {
    // 生成0-1之间的随机数，用于决定消息类型
    const rand = Math.random();
    // 获取当前时间戳，用于消息的时间属性
    const timestamp = Date.now();

    // 根据概率分布选择消息类型
    if (rand < 0.5) {
      // 正常发言 - 最频繁的消息类型
      return this.createNormalSpeakMessage(timestamp);
    } else if (rand < 0.7) {
      // 系统消息 - 游戏系统公告
      return this.createSystemMessage(timestamp);
    } else if (rand < 0.9) {
      // 内心独白 - 显示AI玩家的心理活动
      return this.createPrivateThoughtMessage(timestamp);
    } else {
      // 行动消息 - 玩家执行游戏行动
      return this.createActionMessage(timestamp);
    }
  }

  /**
   * 创建正常发言消息 - 模拟玩家的公开发言
   * 消息特点：
   * 1. 随机选择一个玩家作为发言人
   * 2. 从正常发言内容池中随机选择内容
   * 3. 消息类型为"speak"（发言）
   * 4. 包含完整的发言者信息和时间戳
   */
  private createNormalSpeakMessage(timestamp: number): ChatMessage {
    // 随机选择一个模拟玩家作为发言人
    const player = this.getRandomPlayer();
    // 从正常发言内容池中随机选择一条发言内容
    const content = this.getRandomItem(NORMAL_SPEAK_CONTENTS);

    // 构建发言消息对象
    return {
      // 生成唯一的消息ID：mock-时间戳-消息序号
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      // 消息类型：发言
      type: "speak",
      // 发言者ID
      playerId: player.id,
      // 发言者姓名
      playerName: player.name,
      // 发言内容
      content,
      // 消息时间戳
      timestamp,
    };
  }

  /**
   * 创建系统消息 - 模拟游戏系统公告
   * 消息特点：
   * 1. 固定使用"法官"作为发送者
   * 2. 玩家ID为-1，表示系统消息
   * 3. 消息类型为"system"（系统）
   * 4. 从系统消息内容池中随机选择内容
   * 5. 用于模拟游戏阶段转换、结果宣布等系统事件
   */
  private createSystemMessage(timestamp: number): ChatMessage {
    // 从系统消息内容池中随机选择一条内容
    const content = this.getRandomItem(SYSTEM_MESSAGES);

    // 构建系统消息对象
    return {
      // 生成唯一的消息ID：mock-时间戳-消息序号
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      // 消息类型：系统消息
      type: "system",
      // 系统消息的固定玩家ID：-1
      playerId: -1,
      // 系统消息的固定发送者名称：法官
      playerName: "法官",
      // 系统消息内容
      content,
      // 消息时间戳
      timestamp,
    };
  }

  /**
   * 创建内心独白消息 - 模拟AI玩家的心理活动
   * 消息特点：
   * 1. 包含公开的发言内容和私密的内心独白
   * 2. 消息类型仍为"speak"，但包含privateThought字段
   * 3. 公开内容从正常发言池选择，独白从独白池选择
   * 4. 用于展示AI玩家的推理过程和策略思考
   * 这是AI狼人杀竞技场的核心特色功能
   */
  private createPrivateThoughtMessage(timestamp: number): ChatMessage {
    // 随机选择一个模拟玩家作为发言人
    const player = this.getRandomPlayer();
    // 从正常发言内容池中随机选择公开发言内容
    const content = this.getRandomItem(NORMAL_SPEAK_CONTENTS);
    // 从内心独白内容池中随机选择内心独白内容
    const privateThought = this.getRandomItem(PRIVATE_THOUGHTS);

    // 构建包含内心独白的消息对象
    return {
      // 生成唯一的消息ID：mock-时间戳-消息序号
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      // 消息类型：发言（包含内心独白）
      type: "speak",
      // 发言者ID
      playerId: player.id,
      // 发言者姓名
      playerName: player.name,
      // 公开的发言内容
      content,
      // 私密的内心独白，展示AI的思考过程
      privateThought,
      // 消息时间戳
      timestamp,
    };
  }

  /**
   * 创建行动消息 - 模拟玩家执行游戏行动
   * 消息特点：
   * 1. 消息类型为"action"（行动）
   * 2. 包含玩家执行的具体行动描述
   * 3. 用于模拟狼人杀人、预言家查验、女巫用药等游戏行动
   * 4. 行动内容从行动描述池中随机选择
   */
  private createActionMessage(timestamp: number): ChatMessage {
    // 随机选择一个模拟玩家作为行动执行者
    const player = this.getRandomPlayer();
    // 从行动描述内容池中随机选择一条行动描述
    const content = this.getRandomItem(ACTION_CONTENTS);

    // 构建行动消息对象
    return {
      // 生成唯一的消息ID：mock-时间戳-消息序号
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      // 消息类型：行动
      type: "action",
      // 行动执行者ID
      playerId: player.id,
      // 行动执行者姓名
      playerName: player.name,
      // 行动描述内容
      content,
      // 消息时间戳
      timestamp,
    };
  }

  /**
   * 获取随机玩家 - 从模拟玩家列表中随机选择一个玩家
   * 用途：为消息分配随机的发言者或行动执行者
   * 返回：包含id和name的玩家对象
   */
  private getRandomPlayer(): { id: number; name: string } {
    return this.getRandomItem(MOCK_PLAYERS);
  }

  /**
   * 获取随机数组元素 - 通用工具方法
   * 算法：生成0到数组长度-1的随机整数作为索引
   * 泛型：支持任意类型的数组
   * 用途：从各种内容池中随机选择内容
   */
  private getRandomItem<T>(array: T[]): T {
    // 生成0到数组长度-1之间的随机整数
    const index = Math.floor(Math.random() * array.length);
    // 返回对应索引的数组元素
    return array[index];
  }

  /**
   * 检查引擎运行状态 - 公共API方法
   * 用途：外部组件可以查询Mock引擎是否正在运行
   * 返回：布尔值，true表示引擎正在运行
   */
  isEngineRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取消息计数 - 公共API方法
   * 用途：获取当前已生成的模拟消息数量
   * 返回：消息计数器当前值
   */
  getMessageCount(): number {
    return this.messageCount;
  }
}

/**
 * Mock引擎单例实例 - 全局唯一的Mock引擎实例
 * 设计模式：单例模式实现，确保整个应用中只有一个Mock引擎实例
 * 线程安全：在JavaScript/TypeScript中不需要额外的线程安全措施
 */
let mockEngineInstance: MockEngine | null = null;

/**
 * 获取Mock引擎实例 - 单例工厂函数
 * 实现逻辑：
 * 1. 检查是否已有实例存在
 * 2. 如果没有，创建新的MockEngine实例
 * 3. 返回现有的或新创建的实例
 * 优点：确保全局状态一致，避免重复创建实例浪费资源
 */
export function getMockEngine(): MockEngine {
  // 如果实例不存在，创建新的MockEngine实例
  if (!mockEngineInstance) {
    mockEngineInstance = new MockEngine();
  }
  // 返回单例实例
  return mockEngineInstance;
}
