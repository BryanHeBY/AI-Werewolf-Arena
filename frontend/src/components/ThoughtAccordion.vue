<script setup lang="ts">
import { ref, computed } from "vue";
import { ChevronDown, Eye } from "lucide-vue-next";
import type { ChatMessage } from "@/types/v2-types";

const props = defineProps<{
  msg: ChatMessage;
}>();

const isExpanded = ref(false);

const hasPrivateThought = computed(() => {
  return props.msg.privateThought && props.msg.privateThought.trim().length > 0;
});

const formattedThought = computed(() => {
  if (!props.msg.privateThought) return "";
  return props.msg.privateThought
    .replace(/^思考：/, "")
    .replace(/^Thinking: /, "")
    .replace(/<thinking>/g, "")
    .replace(/<\/thinking>/g, "")
    .trim();
});

const toggle = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div v-if="hasPrivateThought" class="thought-accordion">
    <!-- Header Button -->
    <button
      @click="toggle"
      class="accordion-header w-full bg-surface border border-neon-cyan/50 hover:border-neon-cyan rounded-t-lg p-3 flex items-center justify-between gap-3 transition-all duration-300 group relative overflow-hidden"
    >
      <!-- Glow Effect -->
      <div
        class="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-neon-cyan/10 to-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      <!-- Button Content -->
      <div class="relative flex items-center gap-3">
        <Eye :size="16" class="text-neon-cyan animate-pulse-slow" />
        <span
          class="font-mono text-sm text-neon-cyan group-hover:text-white transition-colors duration-300"
        >
          [ AI 神经元推理过程 ]
        </span>
      </div>

      <!-- Chevron Icon -->
      <ChevronDown
        :size="20"
        :class="[
          'text-neon-cyan transition-transform duration-300 relative',
          isExpanded ? 'rotate-180' : '',
        ]"
      />
    </button>

    <!-- Accordion Content -->
    <Transition
      name="slide"
      @before-enter="(el) => ((el as HTMLElement).style.height = '0')"
      @enter="
        (el) =>
          ((el as HTMLElement).style.height =
            (el as HTMLElement).scrollHeight + 'px')
      "
      @after-enter="(el) => ((el as HTMLElement).style.height = 'auto')"
      @before-leave="
        (el) =>
          ((el as HTMLElement).style.height =
            (el as HTMLElement).scrollHeight + 'px')
      "
      @leave="(el) => ((el as HTMLElement).style.height = '0')"
    >
      <div v-if="isExpanded" class="terminal-content overflow-hidden">
        <!-- Terminal Window -->
        <div
          class="bg-black border border-neon-cyan/50 border-t-0 rounded-b-lg overflow-hidden relative"
        >
          <!-- Scanline Overlay -->
          <div
            class="scanline-overlay absolute inset-0 pointer-events-none opacity-10"
          />

          <!-- Terminal Inner -->
          <div
            class="relative p-4 font-mono text-sm leading-relaxed overflow-auto max-h-[400px]"
          >
            <!-- Terminal Prompt Lines -->
            <div class="text-neon-cyan/60 mb-2">
              <span class="opacity-50">$</span>
              <span class="ml-2">cat /dev/brain/process.log</span>
            </div>

            <!-- Thought Content -->
            <div
              class="thought-text text-neon-green whitespace-pre-wrap break-words"
            >
              <span class="text-neon-cyan/40">></span>
              {{ formattedThought }}
            </div>

            <!-- Terminal Cursor -->
            <div
              class="terminal-cursor inline-block w-2 h-4 bg-neon-cyan animate-pulse ml-1"
            />
          </div>

          <!-- Terminal Status Bar -->
          <div
            class="bg-surface/80 border-t border-neon-cyan/30 px-4 py-2 flex items-center justify-between text-xs font-mono"
          >
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
              <span class="text-neon-green/80">PROCESS RUNNING</span>
            </div>
            <div class="text-neon-cyan/60">
              PID: {{ msg.playerId }} | MEM: 64KB
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Slide Animation */
.slide-enter-active,
.slide-leave-active {
  transition: height 0.3s ease-in-out;
}

.slide-enter-from,
.slide-leave-to {
  height: 0;
}

/* Scanline Overlay */
.scanline-overlay {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.1) 2px,
    rgba(0, 0, 0, 0.1) 4px
  );
}

/* Terminal Text Styling */
.thought-text {
  text-shadow: 0 0 5px rgba(34, 197, 94, 0.3);
}

/* Scrollbar for Terminal */
.terminal-content ::-webkit-scrollbar {
  width: 6px;
}

.terminal-content ::-webkit-scrollbar-track {
  background: #0a0a0a;
  border-left: 1px solid #2a2a2a;
}

.terminal-content ::-webkit-scrollbar-thumb {
  background: #06b6d4;
  border-radius: 3px;
}

.terminal-content ::-webkit-scrollbar-thumb:hover {
  background: #22c55e;
}

/* Glowing Border Animation */
@keyframes border-pulse {
  0%,
  100% {
    border-color: rgba(6, 182, 212, 0.3);
  }
  50% {
    border-color: rgba(6, 182, 212, 0.6);
  }
}

.accordion-header:hover {
  animation: border-pulse 2s ease-in-out infinite;
}

/* Matrix Rain Effect (subtle) */
@keyframes matrix-flicker {
  0%,
  100% {
    opacity: 1;
  }
  92% {
    opacity: 1;
  }
  93% {
    opacity: 0.8;
  }
  94% {
    opacity: 1;
  }
  96% {
    opacity: 0.9;
  }
}

.thought-text::before {
  content: " ";
  animation: matrix-flicker 0.1s infinite;
}
</style>
