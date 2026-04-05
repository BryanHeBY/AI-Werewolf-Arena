import { defineStore } from "pinia";
import type { GameStateUpdate, PlayerInfo } from "@/types/v2-types";

export const useGameStore = defineStore("game", {
  state: () => ({
    myViewId: 0, // Default to god view
    isConnected: false,
    gameState: null as GameStateUpdate | null,
    chatMessages: [] as Array<{
      id: number;
      senderId: number;
      content: string;
      timestamp: number;
      isPrivate: boolean;
      privateThought?: string;
    }>,
    isMockMode: false,
  }),

  actions: {
    setViewId(viewId: number) {
      this.myViewId = viewId;
    },

    updateConnectionStatus(connected: boolean) {
      this.isConnected = connected;
    },

    updateGameState(state: GameStateUpdate) {
      this.gameState = state;
      // Extract chat messages from game state history
      if (state.history) {
        this.chatMessages = state.history.map((msg) => ({
          id:
            typeof msg.id === "string"
              ? parseInt(msg.id.replace("mock-", "").split("-")[0]) || 0
              : msg.id,
          senderId: msg.playerId || -1,
          content: msg.content,
          timestamp: msg.timestamp,
          isPrivate: false,
          privateThought: msg.privateThought,
        }));
      }
    },

    addChatMessage(message: any) {
      // 转换消息格式：v2格式 -> store格式
      const convertedMessage = {
        id:
          typeof message.id === "string"
            ? parseInt(message.id.replace("mock-", "").split("-")[0]) || 0
            : message.id,
        senderId: message.playerId || message.senderId || -1,
        content: message.content || "",
        timestamp: message.timestamp || Date.now(),
        isPrivate: false,
        privateThought: message.privateThought,
      };
      this.chatMessages.push(convertedMessage);
    },

    clearChatMessages() {
      this.chatMessages = [];
    },

    toggleMockMode() {
      this.isMockMode = !this.isMockMode;
    },
  },

  getters: {
    filteredChatMessages: (state) => {
      return state.chatMessages.filter((message) => {
        // Show private thoughts only to god view (0) or the player themselves
        if (message.privateThought) {
          return state.myViewId === 0 || state.myViewId === message.senderId;
        }
        return true; // Show all other message types
      });
    },

    alivePlayers: (state) => {
      if (!state.gameState?.players) return [];
      return state.gameState.players.filter((player) => player.isAlive);
    },

    deadPlayers: (state) => {
      if (!state.gameState?.players) return [];
      return state.gameState.players.filter((player) => !player.isAlive);
    },

    playerById:
      (state) =>
      (id: number): PlayerInfo | undefined => {
        if (!state.gameState?.players) return undefined;
        return state.gameState.players.find((player) => player.id === id);
      },
  },
});
