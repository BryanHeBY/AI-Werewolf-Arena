<script setup lang="ts">
import { useGameStore } from "@/composables/useGameStore";
import TopBar from "@/components/TopBar.vue";
import ChatFlow from "@/components/ChatFlow.vue";

import { Monitor, Play, Pause, MessageSquare } from "lucide-vue-next";
import { computed, ref } from "vue";
import { getMockEngine } from "@/mocks/engine";
import { useGameStore as useV2GameStore } from "@/stores/gameStore";

const game = useGameStore();
const v2Store = useV2GameStore();
const mockEngine = getMockEngine();

const phaseString = computed(() => {
  return game.phase.value;
});

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

const switchToView = (viewId: number) => {
  v2Store.setViewId(viewId);
  console.log(`切换到视角: P${viewId}`, v2Store.myViewId);
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
      <!-- 左侧：玩家列表边栏 (20-25%) -->
      <div class="w-80 border-r border-border bg-surface flex flex-col">
        <!-- 边栏头部 -->
        <div class="p-4 border-b border-border">
          <div class="flex items-center gap-2">
            <MessageSquare :size="18" class="text-neon-cyan" />
            <span class="font-mono text-sm font-bold text-neon-cyan"
              >玩家视角切换器</span
            >
          </div>
          <p class="text-xs font-mono text-textMuted mt-1">
            点击任意玩家切换观战视角
          </p>
        </div>

        <!-- 视角切换列表 -->
        <div class="flex-1 overflow-auto p-3 space-y-2">
          <!-- 上帝视角选项 -->
          <div
            @click="switchToView(0)"
            class="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-surfaceHover relative group"
            :class="[
              v2Store.myViewId === 0
                ? 'border-neon-cyan bg-neon-cyan/10 shadow-glow-cyan ring-2 ring-cyan-500'
                : 'border-border bg-surface/50',
            ]"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-500 border-2 border-cyan-400"
              >
                <span class="font-bold text-white">👁️</span>
              </div>
              <div class="flex-1">
                <div class="font-mono font-bold text-sm text-text">
                  上帝视角
                </div>
                <div class="font-mono text-xs text-textMuted">
                  查看所有消息和私聊想法
                </div>
              </div>
              <div
                v-if="v2Store.myViewId === 0"
                class="text-neon-cyan text-xs font-bold"
              >
                当前视角
              </div>
            </div>
          </div>

          <!-- 玩家列表 -->
          <div
            v-for="player in v2Store.alivePlayers"
            :key="player.id"
            :data-testid="`player-${player.id}`"
            @click="switchToView(player.id)"
            class="p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:bg-surfaceHover relative group"
            :class="[
              v2Store.myViewId === player.id
                ? 'border-neon-purple bg-neon-purple/10 shadow-glow-purple ring-2 ring-purple-500'
                : 'border-border bg-surface/50',
              player.roleType === 'wolf'
                ? 'hover:border-neon-red'
                : 'hover:border-neon-blue',
            ]"
          >
            <div class="flex items-center gap-3">
              <!-- 玩家头像 -->
              <div
                :data-testid="`role-badge-${player.id}`"
                class="w-10 h-10 rounded-full flex items-center justify-center relative"
                :class="[
                  player.roleType === 'wolf'
                    ? 'bg-gradient-to-br from-red-500 to-pink-500 border-2 border-red-400'
                    : 'bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-blue-400',
                ]"
              >
                <span class="font-bold text-white">
                  {{ player.roleType === "wolf" ? "🐺" : "👤" }}
                </span>
                <!-- 存活状态指示器 -->
                <div
                  v-if="player.isAlive"
                  class="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                  :class="[
                    player.roleType === 'wolf'
                      ? 'bg-neon-red shadow-glow-red animate-pulse'
                      : 'bg-neon-green shadow-glow-green animate-pulse',
                  ]"
                />
              </div>

              <!-- 玩家信息 -->
              <div class="flex-1">
                <div
                  class="font-mono font-bold text-sm text-text flex items-center gap-2"
                >
                  <span>{{ player.name }}</span>
                  <span class="text-xs text-textMuted">#{{ player.id }}</span>
                </div>
                <div class="font-mono text-xs text-textMuted">
                  {{ player.roleType === "wolf" ? "狼人" : "村民阵营" }}
                </div>
              </div>

              <!-- 选中指示器 -->
              <div
                v-if="v2Store.myViewId === player.id"
                class="text-neon-purple text-xs font-bold"
              >
                当前视角
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-if="v2Store.alivePlayers.length === 0"
            class="text-center p-6 border-2 border-dashed border-border rounded-lg"
          >
            <MessageSquare :size="32" class="mx-auto mb-3 text-textMuted" />
            <p class="font-mono text-sm text-textMuted">等待玩家数据...</p>
          </div>
        </div>
      </div>

      <!-- 右侧：主聊天区 (75-80%) -->
      <div class="flex-1 flex flex-col">
        <!-- 主区头部 -->
        <div class="p-4 border-b border-border bg-surface relative">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Monitor :size="20" class="text-neon-cyan" />
              <h1
                class="text-xl font-bold text-neon-cyan glitch-text"
                data-text="竞技场监控器"
              >
                竞技场监控器
              </h1>
              <span
                class="font-mono text-xs text-textMuted bg-surface px-2 py-1 rounded border border-border"
              >
                {{ v2Store.chatMessages.length }} 条消息
              </span>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-xs font-mono text-textMuted">
                当前视角: P{{ v2Store.myViewId }}
              </div>
            </div>
          </div>
        </div>

        <!-- 聊天流主区域 -->
        <div class="flex-1 flex flex-col min-h-0">
          <ChatFlow />
        </div>
      </div>
    </div>
  </div>
</template>
