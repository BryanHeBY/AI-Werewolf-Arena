<script setup lang="ts">
import { useGameStore } from "@/composables/useGameStore";
import TopBar from "@/components/TopBar.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import LogTerminal from "@/components/LogTerminal.vue";
import ChatFlow from "@/components/ChatFlow.vue";
import { Monitor, Play, Pause, Eye, MessageSquare } from "lucide-vue-next";
import { computed, ref } from "vue";
import { getMockEngine } from "@/mocks/engine";
import { useGameStore as useV2GameStore } from "@/stores/gameStore";

const game = useGameStore();
const v2Store = useV2GameStore();
const mockEngine = getMockEngine();

const phaseString = computed(() => {
  return game.phase.value;
});

const showV2Chat = ref(true);
const mockEngineRunning = ref(false);

const toggleMock = () => {
  if (mockEngine.isEngineRunning()) {
    mockEngine.stop();
    mockEngineRunning.value = false;
  } else {
    mockEngine.start();
    mockEngineRunning.value = true;
  }
};

const switchView = () => {
  const currentView = v2Store.myViewId;
  const nextView = currentView >= 6 ? 0 : currentView + 1;
  v2Store.setViewId(nextView);
};

const clearMessages = () => {
  v2Store.clearChatMessages();
};
</script>

<template>
  <div
    class="min-h-screen bg-background text-text font-mono scanline crt-effect noise-overlay"
  >
    <TopBar
      :round="game.round.value"
      :phase="phaseString"
      :alive-count="game.aliveCount.value"
      :wolf-count="game.wolfCount.value"
      :villager-count="game.villagerCount.value"
      :is-playing="game.isPlaying.value"
      :is-paused="game.isPaused.value"
      :is-game-over="game.isGameOver.value"
      @start="game.startGame"
      @pause="game.pauseGame"
      @next-step="game.nextStep"
      @reset="game.resetGame"
    />

    <!-- V2 Mock Engine Controls -->
    <div
      class="border-b border-border bg-surface px-6 py-2 flex items-center justify-between"
    >
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <MessageSquare :size="16" class="text-neon-cyan" />
          <span class="text-sm font-bold text-neon-cyan">V2 聊天流控制台</span>
        </div>

        <div class="h-6 w-px bg-border" />

        <button
          @click="toggleMock"
          class="cyber-button px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all duration-300 flex items-center gap-2"
          :class="[
            mockEngineRunning
              ? 'bg-neon-red/10 border-neon-red text-neon-red shadow-glow-red'
              : 'bg-neon-green/10 border-neon-green text-neon-green shadow-glow-green',
          ]"
        >
          <Play v-if="!mockEngineRunning" :size="14" />
          <Pause v-else :size="14" />
          {{ mockEngineRunning ? "停止 Mock 引擎" : "启动 Mock 引擎" }}
        </button>

        <button
          @click="clearMessages"
          class="cyber-button px-4 py-1.5 rounded-lg border border-neon-blue bg-neon-blue/10 text-neon-blue font-mono text-xs font-bold shadow-glow-blue transition-all duration-300"
        >
          清空消息
        </button>

        <div class="h-6 w-px bg-border" />

        <div class="flex items-center gap-2">
          <Eye :size="16" class="text-neon-purple" />
          <span class="text-xs font-mono text-textMuted">视角:</span>
          <button
            @click="switchView"
            class="cyber-button px-3 py-1 rounded-lg border border-neon-purple bg-neon-purple/10 text-neon-purple font-mono text-xs font-bold shadow-glow-purple transition-all duration-300"
          >
            P{{ v2Store.myViewId === 0 ? "上帝" : v2Store.myViewId }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-2 px-3 py-1 rounded-lg border font-mono text-xs"
          :class="[
            mockEngineRunning
              ? 'border-neon-green bg-neon-green/10 text-neon-green'
              : 'border-neon-red bg-neon-red/10 text-neon-red',
          ]"
        >
          <div
            class="w-2 h-2 rounded-full animate-pulse"
            :class="[
              mockEngineRunning
                ? 'bg-neon-green shadow-glow-green'
                : 'bg-neon-red shadow-glow-red',
            ]"
          />
          {{ mockEngineRunning ? "引擎运行中" : "引擎已停止" }}
        </div>
        <div class="text-xs font-mono text-textMuted">
          {{ v2Store.chatMessages.length }} 条消息
        </div>
      </div>
    </div>

    <div class="flex h-[calc(100vh-140px)]">
      <!-- Player Grid -->
      <div class="flex-1 p-6 overflow-auto">
        <div class="max-w-6xl mx-auto">
          <div class="flex items-center gap-2 mb-4">
            <Monitor :size="20" class="text-neon-cyan" />
            <h1
              class="text-xl font-bold text-neon-cyan glitch-text"
              data-text="竞技场监控器"
            >
              竞技场监控器
            </h1>
            <span v-if="game.winner.value" class="ml-auto">
              <span
                class="px-4 py-2 rounded-lg font-bold text-lg animate-pulse"
                :class="
                  game.winner.value === 'wolf'
                    ? 'bg-neon-red text-black shadow-glow-blue-strong'
                    : 'bg-neon-blue text-black shadow-glow-blue-strong'
                "
              >
                🏆
                {{
                  game.winner.value === "wolf"
                    ? "🐺 狼人阵营获胜!"
                    : "👥 好人阵营获胜!"
                }}
              </span>
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PlayerCard
              v-for="player in game.players.value"
              :key="player.id"
              :player="player"
              :is-thinking="game.isThinkingPlayer(player.id)"
            />
          </div>

          <div
            v-if="game.players.value.length === 0"
            class="text-center py-16 border-2 border-dashed border-border rounded-lg"
          >
            <Monitor :size="48" class="mx-auto mb-4 text-textMuted" />
            <p class="text-textMuted font-mono">
              没有玩家数据。点击"开始模拟"开始游戏。
            </p>
          </div>
        </div>
      </div>

      <!-- V2 Chat Flow Component -->
      <div v-if="showV2Chat" class="w-96 border-l border-border p-4">
        <ChatFlow />
      </div>

      <!-- Legacy Log Terminal (hidden by default) -->
      <div v-else class="w-96 border-l border-border p-4">
        <LogTerminal :logs="game.logs.value" />
      </div>
    </div>
  </div>
</template>
