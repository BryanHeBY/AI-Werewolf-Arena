<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, MessageSquare, Brain } from "lucide-vue-next";
import type { LogEntry } from "@/composables/useGameStore";

const props = defineProps<{
  logs: LogEntry[];
}>();

const scrollAreaRef = ref<InstanceType<typeof ScrollArea>>();
const shouldAutoScroll = ref(true);

const formatTimestamp = (timestamp: number) => {
  if (!timestamp || isNaN(timestamp)) return "--:--:--";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
};

const getEntryIcon = (type: string) => {
  switch (type) {
    case "thought":
      return Brain;
    case "action":
      return MessageSquare;
    default:
      return Terminal;
  }
};

const getEntryClass = (entry: LogEntry) => {
  switch (entry.type) {
    case "thought":
      return "text-gray-500 italic font-mono text-sm";
    case "action":
      return "text-neon-cyan font-mono text-sm bg-neon-cyan/5 px-2 py-1 rounded";
    default:
      return "text-neon-green font-mono text-sm";
  }
};

const getEntryPrefix = (entry: LogEntry) => {
  switch (entry.type) {
    case "thought":
      return "💭";
    case "action":
      return "💬";
    default:
      return "📡";
  }
};

watch(
  () => props.logs.length,
  async () => {
    if (shouldAutoScroll.value) {
      await nextTick();
      scrollToBottom();
    }
  },
);

const scrollToBottom = () => {
  const scrollArea = scrollAreaRef.value?.$el;
  if (scrollArea) {
    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }
};
</script>

<template>
  <div
    class="bg-black border border-border rounded-lg flex flex-col h-full overflow-hidden"
  >
    <div
      class="bg-surface border-b border-border p-3 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <Terminal :size="16" class="text-neon-cyan" />
        <span class="font-mono text-sm text-neon-cyan">游戏日志</span>
      </div>
      <div class="flex items-center gap-2 text-xs font-mono text-textMuted">
        <span>日志条目：{{ logs.length }}</span>
      </div>
    </div>

    <ScrollArea
      ref="scrollAreaRef"
      class="flex-1 bg-black/50"
      @scroll="shouldAutoScroll = false"
    >
      <div class="p-4 space-y-2 font-mono">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="flex items-start gap-3 py-1 border-b border-border/20"
        >
          <span class="text-textMuted text-xs shrink-0">
            {{ formatTimestamp(log.timestamp) }}
          </span>

          <component
            :is="getEntryIcon(log.type)"
            :size="14"
            class="shrink-0 mt-0.5"
            :class="log.type === 'thought' ? 'text-gray-600' : 'text-neon-cyan'"
          />

          <div class="flex-1 min-w-0">
            <span class="shrink-0 mr-2">{{ getEntryPrefix(log) }}</span>

            <template v-if="log.playerName">
              <span
                class="text-xs font-bold mr-2 px-1.5 py-0.5 rounded bg-surface border border-border"
              >
                {{ log.playerName }}
              </span>
            </template>

            <span :class="getEntryClass(log)">
              {{ log.message }}
            </span>
          </div>
        </div>

        <div v-if="logs.length === 0" class="text-center py-8">
          <div class="text-textMuted text-sm font-mono">
            <Terminal :size="24" class="mx-auto mb-2 opacity-50" />
            <p>等待游戏事件...</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
