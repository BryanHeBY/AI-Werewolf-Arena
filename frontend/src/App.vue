
/**
 * 主页面布局：顶部控制栏 + 玩家卡片区 + 日志终端。
 */
<script setup lang="ts">
import { useGameStore } from "@/composables/useGameStore";
import TopBar from "@/components/TopBar.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import LogTerminal from "@/components/LogTerminal.vue";
import { Monitor } from "lucide-vue-next";
import { computed } from "vue";

const game = useGameStore();

const phaseString = computed(() => {
  return game.phase.value;
});
</script>

<template>
  <div class="min-h-screen bg-background text-text font-mono scanline">
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

    <div class="flex h-[calc(100vh-80px)]">
      <div class="flex-1 p-6 overflow-auto">
        <div class="max-w-6xl mx-auto">
          <div class="flex items-center gap-2 mb-4">
            <Monitor :size="20" class="text-neon-cyan" />
            <h1 class="text-xl font-bold text-neon-cyan">竞技场监控器</h1>
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

      <div class="w-96 border-l border-border p-4">
        <LogTerminal :logs="game.logs.value" />
      </div>
    </div>
  </div>
</template>
