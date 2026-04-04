import type { ChatMessage } from "@/types/v2-types";
import { useGameStore } from "@/stores/gameStore";

const MOCK_PLAYERS = [
  { id: 1, name: "Player 1" },
  { id: 2, name: "Player 2" },
  { id: 3, name: "Player 3" },
  { id: 4, name: "Player 4" },
  { id: 5, name: "Player 5" },
  { id: 6, name: "Player 6" },
];

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

const PRIVATE_THOUGHTS = [
  "<think>Player 1的发言很可疑，但我不确定，先观察一下...",
  "<think>根据之前的发言，Player 2和Player 4可能是狼人队友...",
  "<think>如果我是狼人，我会选择杀Player 3...",
  "<think>女巫应该还持有解药，可能需要等待时机...",
  "<think>预言家昨晚查验了Player 6，他是好人...",
  "<think>投票给Player 5应该比较安全...",
  "<think>局势对狼人有利，继续潜伏...",
  "<think>村民阵营需要团结起来找出狼人...",
  "<think>这个游戏的策略需要更加谨慎...",
  "<think>内心独白：其实我早就知道真相了...",
];

const ACTION_CONTENTS = [
  "决定投票给Player 5",
  "使用解药救自己",
  "使用毒药杀Player 3",
  "查验Player 2的身份",
  "选择击杀Player 4",
  "放弃使用技能",
  "提名Player 6进行投票",
];

export class MockEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private store: ReturnType<typeof useGameStore>;
  private messageCount = 0;
  private isRunning = false;

  constructor() {
    this.store = useGameStore();
  }

  start(): void {
    if (this.isRunning) {
      console.warn("[MockEngine] Already running");
      return;
    }

    console.log("[MockEngine] Starting mock engine...");
    this.isRunning = true;
    this.store.updateConnectionStatus(true);
    this.intervalId = setInterval(() => {
      this.generateMockMessage();
    }, 2000);
  }

  stop(): void {
    if (!this.isRunning) {
      console.warn("[MockEngine] Not running");
      return;
    }

    console.log("[MockEngine] Stopping mock engine...");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.store.updateConnectionStatus(false);
  }

  private generateMockMessage(): void {
    const message = this.createRandomMessage();
    this.store.addChatMessage(message);
    this.messageCount++;
    console.log(
      `[MockEngine] Message #${this.messageCount} sent:`,
      message.type,
    );
  }

  private createRandomMessage(): ChatMessage {
    const rand = Math.random();
    const timestamp = Date.now();

    if (rand < 0.5) {
      return this.createNormalSpeakMessage(timestamp);
    } else if (rand < 0.7) {
      return this.createSystemMessage(timestamp);
    } else if (rand < 0.9) {
      return this.createPrivateThoughtMessage(timestamp);
    } else {
      return this.createActionMessage(timestamp);
    }
  }

  private createNormalSpeakMessage(timestamp: number): ChatMessage {
    const player = this.getRandomPlayer();
    const content = this.getRandomItem(NORMAL_SPEAK_CONTENTS);

    return {
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      type: "speak",
      playerId: player.id,
      playerName: player.name,
      content,
      timestamp,
    };
  }

  private createSystemMessage(timestamp: number): ChatMessage {
    const content = this.getRandomItem(SYSTEM_MESSAGES);

    return {
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      type: "system",
      playerId: -1,
      playerName: "法官",
      content,
      timestamp,
    };
  }

  private createPrivateThoughtMessage(timestamp: number): ChatMessage {
    const player = this.getRandomPlayer();
    const content = this.getRandomItem(NORMAL_SPEAK_CONTENTS);
    const privateThought = this.getRandomItem(PRIVATE_THOUGHTS);

    return {
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      type: "speak",
      playerId: player.id,
      playerName: player.name,
      content,
      privateThought,
      timestamp,
    };
  }

  private createActionMessage(timestamp: number): ChatMessage {
    const player = this.getRandomPlayer();
    const content = this.getRandomItem(ACTION_CONTENTS);

    return {
      id: `mock-${timestamp}-${this.messageCount + 1}`,
      type: "action",
      playerId: player.id,
      playerName: player.name,
      content,
      timestamp,
    };
  }

  private getRandomPlayer(): { id: number; name: string } {
    return this.getRandomItem(MOCK_PLAYERS);
  }

  private getRandomItem<T>(array: T[]): T {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  getMessageCount(): number {
    return this.messageCount;
  }
}

let mockEngineInstance: MockEngine | null = null;

export function getMockEngine(): MockEngine {
  if (!mockEngineInstance) {
    mockEngineInstance = new MockEngine();
  }
  return mockEngineInstance;
}
