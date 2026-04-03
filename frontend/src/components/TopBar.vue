<script setup lang="ts">
import { Play, Pause, SkipForward, RotateCcw } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { computed } from "vue";

const props = defineProps<{
  round: number;
  phase: string;
  aliveCount: number;
  wolfCount: number;
  villagerCount: number;
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
}>();

defineEmits<{
  start: [];
  pause: [];
  nextStep: [];
  reset: [];
}>();

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

const phaseChinese = computed(() => getPhaseChinese(props.phase));
</script>

<template>
  <div class="bg-surface border-b border-border p-4 scanline">
    <div class="flex items-center justify-between max-w-7xl mx-auto">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="text-sm font-mono">
            第{{ round }}回合
          </Badge>
          <Badge variant="outline" class="text-sm font-mono">
            {{ phaseChinese }}
          </Badge>
        </div>

        <div class="h-8 w-px bg-border"></div>

        <div class="flex items-center gap-3">
          <Badge variant="wolf" class="text-xs">
            🐺 狼人: {{ wolfCount }}
          </Badge>
          <Badge variant="villager" class="text-xs">
            👥 好人: {{ villagerCount }}
          </Badge>
          <Badge variant="outline" class="text-xs">
            存活: {{ aliveCount }}
          </Badge>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="$emit('start')"
          :disabled="isPlaying && !isPaused"
          class="px-4 py-2 rounded-md font-mono text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            isGameOver
              ? 'bg-neon-green hover:bg-neon-green/80 text-black shadow-glow-green'
              : 'bg-neon-cyan hover:bg-neon-cyan/80 text-black shadow-glow-cyan'
          "
        >
          <Play v-if="!isPlaying || isPaused" :size="16" class="inline mr-2" />
          开始模拟
        </button>

        <button
          @click="$emit('pause')"
          :disabled="!isPlaying || isPaused"
          class="px-4 py-2 rounded-md bg-neon-purple hover:bg-neon-purple/80 text-black font-mono text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-purple"
        >
          <Pause :size="16" class="inline mr-2" />
          暂停
        </button>

        <button
          @click="$emit('nextStep')"
          class="px-4 py-2 rounded-md bg-neon-blue hover:bg-neon-blue/80 text-black font-mono text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-blue"
        >
          <SkipForward :size="16" class="inline mr-2" />
          下一步
        </button>

        <button
          @click="$emit('reset')"
          class="px-4 py-2 rounded-md bg-surface hover:bg-surfaceHover text-text font-mono text-sm transition-all duration-200 border border-border"
        >
          <RotateCcw :size="16" class="inline mr-2" />
          重置
        </button>
      </div>
    </div>
  </div>
</template>
