import { ref, computed, onUnmounted } from "vue";
import type {
  PublicGameState,
  PublicPlayer,
  GamePhase,
  RoleType,
  Faction,
  PlayerAction,
  ActionType,
  RealtimeGameEvent,
  GameStartedPayload,
  PhaseChangedPayload,
  AgentThinkingPayload,
  PlayerActionPayload,
  NightResultPayload,
  PlayerDiedPayload,
  SpeechStartPayload,
  VoteResultPayload,
  GameOverPayload,
  WinnerDeclaredPayload,
} from "@/types";
import { MockDataEngine } from "./mockDataEngine";
import { useWebSocket } from "./useWebSocket";

export interface LogEntry {
  type: "thought" | "action" | "system";
  playerId?: number;
  playerName?: string;
  message: string;
  timestamp: number;
  actionType?: ActionType;
}

const USE_REAL_BACKEND = true; // Set to false to use mock data

export function useGameStore() {
  const phase = ref<GamePhase>("Night_Start" as GamePhase);
  const round = ref(1);
  const players = ref<PublicPlayer[]>([]);
  const deadPlayerIds = ref<number[]>([]);
  const history = ref<PlayerAction[]>([]);
  const witchHasAntidote = ref(true);
  const witchHasPoison = ref(true);
  const winner = ref<Faction | undefined>(undefined);
  const logs = ref<LogEntry[]>([]);
  const currentSpeechIndex = ref(0);
  const thinkingPlayers = ref<number[]>([]);

  // WebSocket for real backend
  const ws = useWebSocket("http://localhost:3344");

  // Mock engine for fallback
  const mockEngine = new MockDataEngine();
  const isPlaying = ref(false);
  const isPaused = ref(false);
  const useMock = ref(!USE_REAL_BACKEND);

  const alivePlayers = computed(() => players.value.filter((p) => p.isAlive));
  const deadPlayers = computed(() => players.value.filter((p) => !p.isAlive));
  const aliveCount = computed(() => alivePlayers.value.length);
  const wolfCount = computed(
    () => alivePlayers.value.filter((p) => p.faction === "wolf").length,
  );
  const villagerCount = computed(
    () => alivePlayers.value.filter((p) => p.faction === "villager").length,
  );
  const isGameOver = computed(() => winner.value !== undefined);
  const connectionStatus = computed(() => {
    if (useMock.value) return "Mock Mode";
    if (ws.isConnected.value) return "Connected";
    if (ws.error.value) return "Error: " + ws.error.value;
    return "Disconnected";
  });

  const isThinkingPlayer = (playerId: number) => {
    return thinkingPlayers.value.includes(playerId);
  };

  const addLog = (entry: Omit<LogEntry, "timestamp">) => {
    logs.value.push({
      ...entry,
      timestamp: Date.now(),
    });
  };

  const getPlayer = (playerId: number) => {
    return players.value.find((p) => p.id === playerId);
  };

  const getPhaseChinese = (phase: string): string => {
    const phaseMap: Record<string, string> = {
      Night_Start: "夜晚开始",
      Wolf_Action: "狼人行动",
      Seer_Action: "预言家查验",
      Witch_Action: "女巫行动",
      Day_Start: "白天开始",
      Publish_Night_Result: "公布夜晚结果",
      Sequential_Speech: "顺序发言",
      Vote: "投票阶段",
      Check_Win_Condition: "检查胜利条件",
      Game_Over: "游戏结束",
    };
    return phaseMap[phase] || phase.replace(/_/g, " ");
  };

  const getFactionChinese = (faction: string): string => {
    return faction === "wolf" ? "狼人阵营" : "好人阵营";
  };

  const handleGameStarted = (data: GameStartedPayload) => {
    if (data.players) {
      phase.value = data.phase;
      round.value = data.round;
      players.value = data.players;
    }

    addLog({
      type: "system",
      message: `游戏开始! 第${data.round || round.value}回合`,
    });
  };

  const handlePhaseChanged = (data: PhaseChangedPayload) => {
    phase.value = data.phase;
    if (data.round) {
      round.value = data.round;
    }

    if (data.gameState) {
      const gs = data.gameState;
      players.value = gs.players;
      deadPlayerIds.value = gs.deadPlayerIds;
      history.value = gs.history;
      witchHasAntidote.value = gs.witchHasAntidote;
      witchHasPoison.value = gs.witchHasPoison;
      currentSpeechIndex.value = gs.currentSpeechIndex;
    }

    addLog({
      type: "system",
      message: `阶段变更为: ${getPhaseChinese(String(data.phase))}`,
    });
  };

  const handleAgentThinking = (data: AgentThinkingPayload) => {
    const { playerId, thought } = data;
    if (!playerId || !thought) return;

    if (!thinkingPlayers.value.includes(playerId)) {
      thinkingPlayers.value.push(playerId);
    }
    const player = getPlayer(playerId);

    addLog({
      type: "thought",
      playerId,
      playerName: player?.name || `Player ${playerId}`,
      message: thought,
    });

    setTimeout(() => {
      const index = thinkingPlayers.value.indexOf(playerId);
      if (index > -1) {
        thinkingPlayers.value.splice(index, 1);
      }
    }, 2000);
  };

  const handleAgentThoughtComplete = (data: AgentThinkingPayload) => {
    const { playerId, thought } = data;
    if (!playerId) return;
  };

  const handlePlayerAction = (data: PlayerActionPayload) => {
    const { playerId, roleType, actionType, targetId, content, thought } = data;
    const player = getPlayer(playerId);
    const target = targetId ? getPlayer(targetId) : null;

    let message = "";

    if (actionType === "speak") {
      message = content || "";
      addLog({
        type: "action",
        playerId,
        playerName: player?.name || `玩家${playerId}`,
        message,
        actionType,
      });
    } else if (actionType === "vote") {
      message = `投票给 ${target?.name || `玩家${targetId}`}`;
      addLog({
        type: "action",
        playerId,
        playerName: player?.name || `玩家${playerId}`,
        message,
        actionType,
      });
    } else if (actionType === "kill") {
      message = `选择淘汰 ${target?.name || `玩家${targetId}`}`;
      addLog({
        type: "action",
        playerId,
        playerName: player?.name || `玩家${playerId}`,
        message,
        actionType,
      });
    } else if (actionType === "check") {
      message = `查验 ${target?.name || `玩家${targetId}`}`;
      addLog({
        type: "action",
        playerId,
        playerName: player?.name || `玩家${playerId}`,
        message,
        actionType,
      });
    } else if (actionType === "save") {
      message = `使用解药救了 ${target?.name || `玩家${targetId}`}`;
      addLog({
        type: "action",
        playerId,
        playerName: player?.name || `玩家${playerId}`,
        message,
        actionType,
      });
    } else if (actionType === "poison") {
      message = `使用毒药毒杀 ${target?.name || `玩家${targetId}`}`;
      addLog({
        type: "action",
        playerId,
        playerName: player?.name || `玩家${playerId}`,
        message,
        actionType,
      });
    }
  };

  const handleNightResult = (data: NightResultPayload) => {
    const {
      deadPlayerIds: deadIds,
      killedByWolf,
      savedByWitch,
      poisonedByWitch,
    } = data;

    if (savedByWitch) {
      const savedPlayer = getPlayer(savedByWitch);
      addLog({
        type: "system",
        message: `${savedPlayer?.name || `玩家${savedByWitch}`}被女巫救了!`,
      });
    }

    if (poisonedByWitch) {
      const poisonedPlayer = getPlayer(poisonedByWitch);
      addLog({
        type: "system",
        message: `${poisonedPlayer?.name || `玩家${poisonedByWitch}`}被女巫毒死了!`,
      });
    }

    if (deadIds && deadIds.length === 0) {
      addLog({
        type: "system",
        message: "平安夜 - 无人死亡",
      });
    }
  };

  const handlePlayerDied = (data: PlayerDiedPayload) => {
    const { playerId, roleType } = data;
    const player = getPlayer(playerId);

    if (player) {
      player.isAlive = false;
      deadPlayerIds.value.push(playerId);
    }

    addLog({
      type: "system",
      message: `${player?.name || `玩家${playerId}`} (${roleType}) 被淘汰了!`,
    });
  };

  const handleSpeechStart = (data: SpeechStartPayload) => {
    const { playerId, playerName } = data;

    // 如果提供了playerName，直接使用
    if (playerName) {
      addLog({
        type: "system",
        message: `${playerName}正在发言...`,
      });
      return;
    }

    // 否则尝试通过playerId获取玩家信息
    if (playerId) {
      const player = getPlayer(playerId);
      addLog({
        type: "system",
        message: `${player?.name || `玩家${playerId}`}正在发言...`,
      });
    } else {
      // 如果既没有playerId也没有playerName，记录警告
      console.warn("speech_start事件缺少玩家信息:", data);
      addLog({
        type: "system",
        message: `玩家正在发言...`,
      });
    }
  };

  const handleVoteResult = (data: VoteResultPayload) => {
    const { votedDeadId, votedDeadName, votedOutId, votedOutName } = data;

    const playerName = votedDeadName || votedOutName;
    const playerId = votedDeadId || votedOutId;

    if (playerName) {
      addLog({
        type: "system",
        message: `投票结果: ${playerName}被投票出局`,
      });
      return;
    }

    if (playerId !== undefined) {
      const deadPlayer = getPlayer(playerId);
      addLog({
        type: "system",
        message: `投票结果: ${deadPlayer?.name || `玩家${playerId}`}被投票出局`,
      });
    } else {
      console.warn("vote_result事件缺少玩家信息:", data);
      addLog({
        type: "system",
        message: `投票结果: 有玩家被投票出局`,
      });
    }
  };

  const handleGameOver = (data: GameOverPayload) => {
    const { winner: gameWinner } = data;
    winner.value = gameWinner;

    addLog({
      type: "system",
      message: `游戏结束! ${gameWinner === "wolf" ? "🐺 狼人阵营" : "👥 好人阵营"}获胜!`,
    });
  };

  const handleWinnerDeclared = (data: WinnerDeclaredPayload) => {
    const { winner: gameWinner, message } = data;
    winner.value = gameWinner;

    addLog({
      type: "system",
      message: message || `获胜者宣布: ${getFactionChinese(gameWinner)}`,
    });
  };

  const setupMockEngine = () => {
    mockEngine.on("game_started", handleGameStarted);
    mockEngine.on("phase_changed", handlePhaseChanged);
    mockEngine.on("agent_thinking", handleAgentThinking);
    mockEngine.on("player_action", handlePlayerAction);
    mockEngine.on("night_result", handleNightResult);
    mockEngine.on("player_died", handlePlayerDied);
    mockEngine.on("speech_start", handleSpeechStart);
    mockEngine.on("vote_result", handleVoteResult);
    mockEngine.on("game_over", handleGameOver);
    mockEngine.on("winner_declared", handleWinnerDeclared);
  };

  const setupWebSocket = () => {
    ws.on<RealtimeGameEvent>("gameEvent", (event) => {
      const { type, data, timestamp } = event;
      console.log("Received game event:", type, data);

      switch (type) {
        case "game_started":
          handleGameStarted(data);
          break;
        case "phase_changed":
          handlePhaseChanged(data);
          break;
        case "agent_thinking":
          handleAgentThinking(data);
          break;
        case "agent_thought_complete":
          handleAgentThoughtComplete(data);
          break;
        case "player_action":
          handlePlayerAction(data);
          break;
        case "night_result":
          handleNightResult(data);
          break;
        case "player_died":
          handlePlayerDied(data);
          break;
        case "speech_start":
          handleSpeechStart(data);
          break;
        case "vote_result":
          handleVoteResult(data);
          break;
        case "game_over":
          handleGameOver(data);
          break;
        case "winner_declared":
          handleWinnerDeclared(data);
          break;
        default:
          console.warn("Unknown game event type:", type, data);
      }
    });
  };

  const startGame = () => {
    if (isGameOver.value) {
      resetGame();
    }

    if (useMock.value) {
      setupMockEngine();
      mockEngine.play();
    } else {
      ws.connect();
      setupWebSocket();
      // Just connect to WebSocket to listen for existing game events
      // Games are started via backend API, not from frontend
      console.log("Connected to WebSocket to listen for game events");
    }

    isPlaying.value = true;
    isPaused.value = false;
  };

  const pauseGame = () => {
    if (useMock.value) {
      mockEngine.pause();
    }
    isPlaying.value = false;
    isPaused.value = true;
  };

  const nextStep = () => {
    if (useMock.value) {
      if (!isPlaying.value || isPaused.value) {
        setupMockEngine();
      }
      mockEngine.nextStep();
      isPlaying.value = !mockEngine.isComplete();
    }
    isPaused.value = false;
  };

  const resetGame = () => {
    if (useMock.value) {
      mockEngine.reset();
    } else {
      ws.disconnect();
    }

    phase.value = "Night_Start" as GamePhase;
    round.value = 1;
    players.value = [];
    deadPlayerIds.value = [];
    history.value = [];
    witchHasAntidote.value = true;
    witchHasPoison.value = true;
    winner.value = undefined;
    logs.value = [];
    currentSpeechIndex.value = 0;
    thinkingPlayers.value = [];
    isPlaying.value = false;
    isPaused.value = false;
  };

  return {
    phase,
    round,
    players,
    deadPlayerIds,
    history,
    witchHasAntidote,
    witchHasPoison,
    winner,
    logs,
    currentSpeechIndex,
    thinkingPlayers,
    isThinkingPlayer,
    alivePlayers,
    deadPlayers,
    aliveCount,
    wolfCount,
    villagerCount,
    isGameOver,
    isPlaying,
    isPaused,
    connectionStatus,
    startGame,
    pauseGame,
    nextStep,
    resetGame,
  };
}
