import { defineStore } from "pinia";
import type {
  GameStateUpdate,
  ChatMessage,
  PlayerInfo,
} from "@/types/v2-types";

export const useGameStore = defineStore("game", {
  state: () => ({
    myViewId: 0, // Default to god view
    isConnected: false,
    gameState: null as GameStateUpdate | null,
    chatMessages: [] as ChatMessage[],
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
        this.chatMessages = state.history;
      }
    },

    addChatMessage(message: ChatMessage) {
      this.chatMessages.push(message);
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
          return state.myViewId === 0 || state.myViewId === message.playerId;
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
