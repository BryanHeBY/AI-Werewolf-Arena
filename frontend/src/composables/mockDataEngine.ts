// 导入游戏相关的类型定义
import type {
  PublicGameState,
  PlayerAction,
  BroadcastEvent,
  GamePhase,
  RoleType,
  Faction,
  ActionType,
} from "@/types";

// 游戏角色配置：标准的6人狼人杀角色配置
// 包含：2狼人、1预言家、1女巫、2村民
const ROLES: RoleType[] = [
  "wolf",
  "wolf",
  "seer",
  "witch",
  "villager",
  "villager",
];
// 玩家名称：使用希腊字母命名，便于区分
const PLAYER_NAMES = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];

/**
 * 模拟事件接口
 * 定义Mock引擎生成的事件数据结构
 */
interface MockEvent {
  type: string; // 事件类型，如'game_started'、'phase_changed'、'player_action'等
  data: any; // 事件数据，包含具体的游戏状态或行动信息
  thought?: string; // 可选，AI的内心独白，展示AI的思考过程
  playerId?: number; // 可选，关联的玩家ID，用于行动或思考事件
  delay: number; // 事件触发前的延迟时间（毫秒），控制游戏节奏
}

/**
 * 模拟数据引擎类
 * 生成完整的狼人杀游戏模拟数据，用于开发、测试和演示
 * 模拟游戏的全过程，包括夜晚行动、白天发言、投票等各个阶段
 */
export class MockDataEngine {
  // 事件队列：存储按顺序执行的游戏事件
  private events: MockEvent[] = [];
  // 当前事件索引：表示当前正在处理的事件位置
  private currentIndex = 0;
  // 播放状态：表示引擎是否正在运行（自动播放模式）
  private isPlaying = false;
  // 暂停状态：表示引擎是否被手动暂停
  private isPaused = false;
  // 定时器：用于实现事件的延迟执行
  private timer: NodeJS.Timeout | null = null;
  // 回调函数映射：存储不同类型事件的回调函数
  private callbacks: Map<string, (data: any) => void> = new Map();

  /**
   * 构造函数
   * 初始化Mock引擎，并生成完整的游戏事件序列
   */
  constructor() {
    this.generateGame(); // 生成游戏事件序列
  }

  /**
   * 生成完整的游戏事件序列
   * 按照狼人杀游戏的标准流程创建一系列事件
   */
  private generateGame() {
    // 清空现有事件队列
    this.events = [];

    // 1. 游戏开始事件：初始化游戏状态
    this.events.push({
      type: "game_started",
      data: {
        phase: "Night_Start" as GamePhase,
        round: 1,
        players: this.createInitialPlayers(),
        deadPlayerIds: [],
        history: [],
        witchHasAntidote: true,
        witchHasPoison: true,
        currentSpeechIndex: 0,
      },
      delay: 1000,
    });

    this.events.push({
      type: "agent_thinking",
      playerId: 1,
      thought:
        "I'm a wolf. Need to coordinate with my partner and eliminate a threat tonight.",
      data: { playerId: 1 },
      delay: 2000,
    });

    this.events.push({
      type: "agent_thinking",
      playerId: 2,
      thought: "I'm a wolf too. Let's work together. Player 3 looks dangerous.",
      data: { playerId: 2 },
      delay: 2000,
    });

    this.events.push({
      type: "player_action",
      playerId: 1,
      thought: "I'll attack player 5 tonight. They seem suspicious.",
      data: {
        playerId: 1,
        roleType: "wolf" as RoleType,
        actionType: "kill" as ActionType,
        targetId: 5,
        content: undefined,
        thought: "I'll attack player 5 tonight. They seem suspicious.",
        timestamp: Date.now(),
      },
      delay: 1500,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Wolf_Action" as GamePhase,
        round: 1,
      },
      delay: 1000,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Seer_Action" as GamePhase,
        round: 1,
      },
      delay: 1000,
    });

    this.events.push({
      type: "agent_thinking",
      playerId: 3,
      thought:
        "I'm the seer. Need to check someone to find wolves. Let me check player 1.",
      data: { playerId: 3 },
      delay: 2000,
    });

    this.events.push({
      type: "player_action",
      playerId: 3,
      thought: "Checking player 1 to determine if they're a wolf...",
      data: {
        playerId: 3,
        roleType: "seer" as RoleType,
        actionType: "check" as ActionType,
        targetId: 1,
        content: undefined,
        thought: "Checking player 1 to determine if they're a wolf...",
        timestamp: Date.now(),
      },
      delay: 1500,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Witch_Action" as GamePhase,
        round: 1,
      },
      delay: 1000,
    });

    this.events.push({
      type: "agent_thinking",
      playerId: 4,
      thought:
        "I'm the witch. Someone was attacked tonight. Should I save them or use poison?",
      data: { playerId: 4 },
      delay: 2000,
    });

    this.events.push({
      type: "player_action",
      playerId: 4,
      thought: "I'll save player 5 with my antidote tonight.",
      data: {
        playerId: 4,
        roleType: "witch" as RoleType,
        actionType: "save" as ActionType,
        targetId: 5,
        content: undefined,
        thought: "I'll save player 5 with my antidote tonight.",
        timestamp: Date.now(),
      },
      delay: 1500,
    });

    this.events.push({
      type: "night_result",
      data: {
        deadPlayerIds: [],
        killedByWolf: 5,
        savedByWitch: 5,
      },
      delay: 1000,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Day_Start" as GamePhase,
        round: 1,
      },
      delay: 1000,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Sequential_Speech" as GamePhase,
        round: 1,
      },
      delay: 1000,
    });

    for (let i = 0; i < 6; i++) {
      const player = i + 1;
      this.events.push({
        type: "speech_start",
        playerId: player,
        thought: `Player ${player} preparing to speak...`,
        data: { playerId: player, index: i },
        delay: 1500,
      });

      this.events.push({
        type: "agent_thinking",
        playerId: player,
        thought: this.generateThought(player),
        data: { playerId: player },
        delay: 2000,
      });

      this.events.push({
        type: "player_action",
        playerId: player,
        thought: this.generateThought(player),
        data: {
          playerId: player,
          roleType: ROLES[i],
          actionType: "speak" as ActionType,
          content: this.generateSpeech(player),
          thought: this.generateThought(player),
          timestamp: Date.now(),
        },
        delay: 2500,
      });
    }

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Vote" as GamePhase,
        round: 1,
      },
      delay: 1000,
    });

    this.events.push({
      type: "vote_result",
      data: {
        votes: [
          { voterId: 1, targetId: 3 },
          { voterId: 2, targetId: 3 },
          { voterId: 3, targetId: 1 },
          { voterId: 4, targetId: 3 },
          { voterId: 5, targetId: 1 },
          { voterId: 6, targetId: 3 },
        ],
        votedDeadId: 3,
      },
      delay: 1000,
    });

    this.events.push({
      type: "player_died",
      playerId: 3,
      data: {
        playerId: 3,
        roleType: "seer" as RoleType,
      },
      delay: 1000,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Check_Win_Condition" as GamePhase,
        round: 1,
      },
      delay: 500,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Night_Start" as GamePhase,
        round: 2,
      },
      delay: 1000,
    });

    this.events.push({
      type: "agent_thinking",
      playerId: 1,
      thought:
        "Good! We eliminated the seer. Now we need to eliminate the witch or villagers.",
      data: { playerId: 1 },
      delay: 2000,
    });

    this.events.push({
      type: "player_action",
      playerId: 1,
      thought: "I'll attack player 4 (the witch) tonight.",
      data: {
        playerId: 1,
        roleType: "wolf" as RoleType,
        actionType: "kill" as ActionType,
        targetId: 4,
        content: undefined,
        thought: "I'll attack player 4 (the witch) tonight.",
        timestamp: Date.now(),
      },
      delay: 1500,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Wolf_Action" as GamePhase,
        round: 2,
      },
      delay: 1000,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Seer_Action" as GamePhase,
        round: 2,
      },
      delay: 1000,
    });

    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Witch_Action" as GamePhase,
        round: 2,
      },
      delay: 1000,
    });

    this.events.push({
      type: "agent_thinking",
      playerId: 4,
      thought:
        "I'm being attacked tonight! I should save myself, but I already used my antidote...",
      data: { playerId: 4 },
      delay: 2000,
    });

    this.events.push({
      type: "player_action",
      playerId: 4,
      thought: "I can't save myself. I'll use my poison on player 1.",
      data: {
        playerId: 4,
        roleType: "witch" as RoleType,
        actionType: "poison" as ActionType,
        targetId: 1,
        content: undefined,
        thought: "I'll use poison on player 1 before I die.",
        timestamp: Date.now(),
      },
      delay: 1500,
    });

    this.events.push({
      type: "night_result",
      data: {
        deadPlayerIds: [4, 1],
        killedByWolf: 4,
        poisonedByWitch: 1,
      },
      delay: 1000,
    });

    // 29. 玩家死亡事件：女巫（玩家4）死亡
    this.events.push({
      type: "player_died",
      playerId: 4,
      data: {
        playerId: 4,
        roleType: "witch" as RoleType,
      },
      delay: 500, // 延迟0.5秒后触发
    });

    // 30. 玩家死亡事件：狼人1（玩家1）死亡
    this.events.push({
      type: "player_died",
      playerId: 1,
      data: {
        playerId: 1,
        roleType: "wolf" as RoleType,
      },
      delay: 500, // 延迟0.5秒后触发
    });

    // 31. 阶段变更：第二天开始
    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Day_Start" as GamePhase,
        round: 2,
      },
      delay: 1000, // 延迟1秒后触发
    });

    // 32. 阶段变更：检查胜利条件（第二晚后）
    this.events.push({
      type: "phase_changed",
      data: {
        phase: "Check_Win_Condition" as GamePhase,
        round: 2,
      },
      delay: 500, // 延迟0.5秒后触发
    });

    // 33. 游戏结束事件：村民阵营胜利
    this.events.push({
      type: "game_over",
      data: {
        winner: "villager" as Faction, // 胜利阵营：好人（村民）阵营
      },
      delay: 1000, // 延迟1秒后触发
    });

    // 34. 胜利宣告事件：具体胜利信息
    this.events.push({
      type: "winner_declared",
      data: {
        winner: "villager" as Faction, // 胜利阵营：好人（村民）阵营
        message: "Villagers win! Both wolves have been eliminated.", // 胜利消息
      },
      delay: 1000, // 延迟1秒后触发
    });
  }

  private createInitialPlayers() {
    return PLAYER_NAMES.map((name, index) => ({
      id: index + 1,
      name,
      roleType: ROLES[index],
      faction: ROLES[index] === "wolf" ? "wolf" : ("villager" as Faction),
      isAlive: true,
    }));
  }

  private generateThought(playerId: number): string {
    const thoughts = [
      "Hmm, I need to be careful about what I reveal.",
      "The villagers seem suspicious. I should play along.",
      "I need to protect my identity while gathering information.",
      "Someone is lying, but who?",
      "I should vote for the most suspicious person.",
      "Let me think about the best strategy...",
    ];
    return thoughts[(playerId - 1) % thoughts.length];
  }

  private generateSpeech(playerId: number): string {
    const speeches = [
      "I think we need to be careful today. Not everyone is who they claim to be.",
      "I've been observing everyone's behavior, and something feels off.",
      "I'm a simple villager, just trying to survive this night.",
      "We need to find the wolves quickly before they eliminate us all.",
      "I trust most of you, but there's definitely something suspicious going on.",
      "Let's vote wisely today. Our lives depend on it.",
    ];
    return speeches[(playerId - 1) % speeches.length];
  }

  on(event: string, callback: (data: any) => void) {
    this.callbacks.set(event, callback);
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.isPaused = false;
    this.scheduleNextEvent();
  }

  pause() {
    this.isPaused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  nextStep() {
    if (this.currentIndex >= this.events.length) return;

    const event = this.events[this.currentIndex];
    this.dispatchEvent(event);
    this.currentIndex++;
  }

  private scheduleNextEvent() {
    if (this.currentIndex >= this.events.length || this.isPaused) {
      this.isPlaying = false;
      return;
    }

    const event = this.events[this.currentIndex];

    this.timer = setTimeout(() => {
      if (this.isPaused) {
        this.isPlaying = false;
        return;
      }
      this.dispatchEvent(event);
      this.currentIndex++;
      this.scheduleNextEvent();
    }, event.delay);
  }

  private dispatchEvent(event: MockEvent) {
    const callback = this.callbacks.get(event.type);
    if (callback) {
      callback(event.data);
    }

    if (event.type === "agent_thinking" && event.thought) {
      const thinkingCallback = this.callbacks.get("agent_thinking");
      if (thinkingCallback) {
        thinkingCallback({ playerId: event.playerId, thought: event.thought });
      }
    }
  }

  reset() {
    this.pause();
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
  }

  isComplete(): boolean {
    return this.currentIndex >= this.events.length;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalEvents(): number {
    return this.events.length;
  }
}
