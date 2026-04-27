<script setup lang="ts">
// 导入Vue响应式API
import { ref, watch, nextTick } from "vue";
// 导入UI组件库组件
import { ScrollArea } from "@/components/ui/scroll-area";
// 导入图标组件
import { Terminal, MessageSquare, Brain } from "lucide-vue-next";
// 导入日志条目类型定义
import type { LogEntry } from "@/composables/useGameStore";

// 定义组件属性
const props = defineProps<{
  logs: LogEntry[];  // 日志条目数组，由父组件传入
}>();

// 滚动区域引用，用于控制滚动行为
const scrollAreaRef = ref<InstanceType<typeof ScrollArea>>();
// 是否启用自动滚动：当新日志到达时自动滚动到底部
const shouldAutoScroll = ref(true);

/**
 * 格式化时间戳为可读的时间字符串
 * @param timestamp - Unix时间戳（毫秒）
 * @returns 格式化的时间字符串（HH:MM:SS.sss）
 */
const formatTimestamp = (timestamp: number) => {
  if (!timestamp || isNaN(timestamp)) return "--:--:--";  // 无效时间戳处理
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,            // 24小时制
    hour: "2-digit",          // 两位数小时
    minute: "2-digit",        // 两位数分钟
    second: "2-digit",        // 两位数秒
  });
};

/**
 * 根据日志类型获取对应的图标组件
 * @param type - 日志类型（thought/action/system）
 * @returns 对应的图标组件
 */
const getEntryIcon = (type: string) => {
  switch (type) {
    case "thought":      // AI内心独白类型
      return Brain;      // 大脑图标，象征思考
    case "action":       // 玩家行动类型
      return MessageSquare;  // 消息方块图标，象征行动
    default:             // 系统消息类型
      return Terminal;   // 终端图标，象征系统
  }
};

/**
 * 根据日志条目获取对应的CSS类
 * 用于不同类型日志的视觉区分
 * @param entry - 日志条目对象
 * @returns 对应的CSS类字符串
 */
const getEntryClass = (entry: LogEntry) => {
  switch (entry.type) {
    case "thought":      // 内心独白类型
      return "text-gray-500 italic font-mono text-sm";  // 灰色斜体，终端字体
    case "action":       // 行动类型
      return "text-neon-cyan font-mono text-sm bg-neon-cyan/5 px-2 py-1 rounded";  // 青色霓虹文字，淡青色背景
    default:             // 系统消息类型
      return "text-neon-green font-mono text-sm";  // 绿色霓虹文字
  }
};

/**
 * 根据日志条目获取对应的前缀表情符号
 * 用于在日志内容前显示视觉标识
 * @param entry - 日志条目对象
 * @returns 对应的表情符号
 */
const getEntryPrefix = (entry: LogEntry) => {
  switch (entry.type) {
    case "thought":      // 内心独白类型
      return "💭";       // 思考气泡表情
    case "action":       // 行动类型
      return "💬";       // 对话气泡表情
    default:             // 系统消息类型
      return "📡";       // 卫星天线表情，象征系统广播
  }
};

/**
 * 监听日志数组长度的变化
 * 当有新日志添加时，如果启用自动滚动，则滚动到底部
 */
watch(
  () => props.logs.length,  // 监听日志数组长度
  async () => {
    if (shouldAutoScroll.value) {  // 只有当自动滚动启用时才执行
      await nextTick();             // 等待DOM更新
      scrollToBottom();             // 滚动到底部
    }
  },
);

/**
 * 滚动到日志区域底部
 * 用于确保最新日志始终可见
 */
const scrollToBottom = () => {
  const scrollArea = scrollAreaRef.value?.$el;  // 获取滚动区域的DOM元素
  if (scrollArea) {
    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]",  // 查找滚动视口元素
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;  // 设置滚动位置为最大高度
    }
  }
};
</script>

<template>
  <!-- 终端风格日志容器 -->
  <div
    class="bg-black border border-border rounded-lg flex flex-col h-full overflow-hidden"
  >
    <!-- 标题栏区域 -->
    <div
      class="bg-surface border-b border-border p-3 flex items-center justify-between"
    >
      <!-- 左侧：标题和图标 -->
      <div class="flex items-center gap-2">
        <Terminal :size="16" class="text-neon-cyan" />  <!-- 终端图标 -->
        <span class="font-mono text-sm text-neon-cyan">游戏日志</span>  <!-- 标题 -->
      </div>
      
      <!-- 右侧：日志统计信息 -->
      <div class="flex items-center gap-2 text-xs font-mono text-textMuted">
        <span>日志条目：{{ logs.length }}</span>  <!-- 显示日志数量 -->
      </div>
    </div>

    <!-- 滚动区域：包含所有日志条目 -->
    <ScrollArea
      ref="scrollAreaRef"
      class="flex-1 bg-black/50"
      @scroll="shouldAutoScroll = false"  <!-- 用户手动滚动时关闭自动滚动 -->
    >
      <div class="p-4 space-y-2 font-mono">
        <!-- 遍历所有日志条目 -->
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="flex items-start gap-3 py-1 border-b border-border/20"
        >
          <!-- 时间戳区域：显示日志发生的时间 -->
          <span class="text-textMuted text-xs shrink-0">
            {{ formatTimestamp(log.timestamp) }}
          </span>

          <!-- 日志类型图标：根据日志类型显示不同的图标 -->
          <component
            :is="getEntryIcon(log.type)"
            :size="14"
            class="shrink-0 mt-0.5"
            :class="log.type === 'thought' ? 'text-gray-600' : 'text-neon-cyan'"
          />

          <!-- 日志内容主体区域 -->
          <div class="flex-1 min-w-0">
            <!-- 日志前缀：表情符号 -->
            <span class="shrink-0 mr-2">{{ getEntryPrefix(log) }}</span>

            <!-- 玩家名称：如果有玩家名称则显示 -->
            <template v-if="log.playerName">
              <span
                class="text-xs font-bold mr-2 px-1.5 py-0.5 rounded bg-surface border border-border"
              >
                {{ log.playerName }}
              </span>
            </template>

            <!-- 日志消息内容 -->
            <span :class="getEntryClass(log)">
              {{ log.message }}
            </span>
          </div>
        </div>

        <!-- 空状态：当没有日志时显示 -->
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
