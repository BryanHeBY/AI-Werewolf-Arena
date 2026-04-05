<script setup lang="ts">
// 导入Vue响应式API
import { ref, computed } from "vue";
// 导入图标组件
import { ChevronDown, Eye } from "lucide-vue-next";
// 导入聊天消息类型定义
import type { ChatMessage } from "@/types/v2-types";

// 定义组件属性
const props = defineProps<{
  msg: ChatMessage;  // 聊天消息对象，包含内心独白信息
}>();

// 控制折叠面板是否展开的状态
const isExpanded = ref(false);

/**
 * 计算属性：检查消息是否包含有效的内心独白
 * 用于条件渲染，只有当有内心独白时才显示折叠面板
 * @returns 布尔值，表示是否有内心独白
 */
const hasPrivateThought = computed(() => {
  return props.msg.privateThought && props.msg.privateThought.trim().length > 0;
});

/**
 * 计算属性：格式化内心独白内容
 * 移除格式标记和前缀，返回干净的独白内容
 * @returns 格式化后的内心独白字符串
 */
const formattedThought = computed(() => {
  if (!props.msg.privateThought) return "";
  
  return props.msg.privateThought
    .replace(/^思考：/, "")      // 移除中文前缀"思考："
    .replace(/^Thinking: /, "")  // 移除英文前缀"Thinking: "
    .replace(/<thinking>/g, "")  // 移除<thinking>标签
    .replace(/<\/thinking>/g, "") // 移除</thinking>标签
    .trim();                     // 移除首尾空白字符
});

/**
 * 切换折叠面板展开/收起状态
 */
const toggle = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <!-- 条件渲染：只有当有内心独白时才显示 -->
  <div v-if="hasPrivateThought" class="thought-accordion">
    <!-- 头部按钮：点击展开/收起折叠面板 -->
    <button
      @click="toggle"
      class="accordion-header w-full bg-surface border border-neon-cyan/50 hover:border-neon-cyan rounded-t-lg p-3 flex items-center justify-between gap-3 transition-all duration-300 group relative overflow-hidden"
    >
      <!-- 发光效果背景：悬停时显示的渐变背景 -->
      <div
        class="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-neon-cyan/10 to-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      <!-- 按钮内容：眼睛图标 + 标题文字 -->
      <div class="relative flex items-center gap-3">
        <Eye :size="16" class="text-neon-cyan animate-pulse-slow" />  <!-- 眼睛图标，缓慢脉冲动画 -->
        <span
          class="font-mono text-sm text-neon-cyan group-hover:text-white transition-colors duration-300"
        >
          [ AI 神经元推理过程 ]  <!-- 标题文字，强调AI思考过程 -->
        </span>
      </div>

      <!-- 展开/收起箭头图标 -->
      <ChevronDown
        :size="20"
        :class="[
          'text-neon-cyan transition-transform duration-300 relative',
          isExpanded ? 'rotate-180' : '',  // 展开时旋转180度，指向下方
        ]"
      />
    </button>

    <!-- 折叠面板内容区域，使用Vue过渡动画 -->
    <Transition
      name="slide"  <!-- 使用自定义slide过渡动画 -->
      @before-enter="(el) => ((el as HTMLElement).style.height = '0')"  <!-- 进入前设置高度为0 -->
      @enter="
        (el) =>
          ((el as HTMLElement).style.height =
            (el as HTMLElement).scrollHeight + 'px')  <!-- 进入时设置为实际高度 -->
      "
      @after-enter="(el) => ((el as HTMLElement).style.height = 'auto')"  <!-- 进入后设置为auto -->
      @before-leave="
        (el) =>
          ((el as HTMLElement).style.height =
            (el as HTMLElement).scrollHeight + 'px')  <!-- 离开前记录当前高度 -->
      "
      @leave="(el) => ((el as HTMLElement).style.height = '0')"  <!-- 离开时高度归零 -->
    >
      <!-- 条件渲染：只有展开时才显示内容 -->
      <div v-if="isExpanded" class="terminal-content overflow-hidden">
        <!-- 终端窗口容器 -->
        <div
          class="bg-black border border-neon-cyan/50 border-t-0 rounded-b-lg overflow-hidden relative"
        >
          <!-- 扫描线叠加效果：模拟CRT显示器的扫描线 -->
          <div
            class="scanline-overlay absolute inset-0 pointer-events-none opacity-10"
          />

          <!-- 终端内部内容区域 -->
          <div
            class="relative p-4 font-mono text-sm leading-relaxed overflow-auto max-h-[400px]"
          >
            <!-- 终端提示符行：模拟Linux终端命令 -->
            <div class="text-neon-cyan/60 mb-2">
              <span class="opacity-50">$</span>  <!-- 终端提示符 -->
              <span class="ml-2">cat /dev/brain/process.log</span>  <!-- 模拟读取大脑进程日志 -->
            </div>

            <!-- 内心独白内容区域 -->
            <div
              class="thought-text text-neon-green whitespace-pre-wrap break-words"
            >
              <span class="text-neon-cyan/40">></span>  <!-- 内容前缀箭头 -->
              {{ formattedThought }}  <!-- 格式化后的内心独白内容 -->
            </div>

            <!-- 终端光标：模拟终端闪烁的光标 -->
            <div
              class="terminal-cursor inline-block w-2 h-4 bg-neon-cyan animate-pulse ml-1"
            />
          </div>

          <!-- 终端状态栏 -->
          <div
            class="bg-surface/80 border-t border-neon-cyan/30 px-4 py-2 flex items-center justify-between text-xs font-mono"
          >
            <!-- 左侧：进程状态指示器 -->
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-neon-green animate-pulse" />  <!-- 绿色脉冲点 -->
              <span class="text-neon-green/80">PROCESS RUNNING</span>  <!-- 进程运行状态 -->
            </div>
            
            <!-- 右侧：进程信息 -->
            <div class="text-neon-cyan/60">
              PID: {{ msg.playerId }} | MEM: 64KB  <!-- 进程ID和内存使用量 -->
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 幻灯片动画：用于折叠面板展开/收起 */
.slide-enter-active,
.slide-leave-active {
  transition: height 0.3s ease-in-out;  /* 高度变化的平滑过渡 */
}

.slide-enter-from,
.slide-leave-to {
  height: 0;  /* 动画开始/结束时的状态 */
}

/* 扫描线叠加效果 */
.scanline-overlay {
  background: repeating-linear-gradient(
    0deg,                /* 垂直方向 */
    transparent,          /* 透明线 */
    transparent 2px,      /* 2像素透明 */
    rgba(0, 0, 0, 0.1) 2px,  /* 2像素微黑色 */
    rgba(0, 0, 0, 0.1) 4px   /* 4像素重复 */
  );
}

/* 内心独白文字样式 */
.thought-text {
  text-shadow: 0 0 5px rgba(34, 197, 94, 0.3);  /* 绿色霓虹发光效果 */
}

/* 终端内容区域的滚动条样式 */
.terminal-content {
  border-left: 1px solid #2a2a2a;  /* 左侧边框 */
}

.terminal-content ::-webkit-scrollbar-thumb {
  background: #06b6d4;  /* 滚动条滑块颜色（青色） */
  border-radius: 3px;   /* 圆角 */
}

.terminal-content ::-webkit-scrollbar-thumb:hover {
  background: #22c55e;  /* 悬停时变为绿色 */
}

/* 边框脉冲动画：悬停时边框发光效果 */
@keyframes border-pulse {
  0%,
   100% {
    border-color: rgba(6, 182, 212, 0.3);  /* 弱青色边框 */
  }
  50% {
    border-color: rgba(6, 182, 212, 0.6);  /* 强青色边框 */
  }
}

.accordion-header:hover {
  animation: border-pulse 2s ease-in-out infinite;  /* 悬停时无限循环 */
}

/* 矩阵雨滴闪烁效果：模拟黑客终端特效 */
@keyframes matrix-flicker {
   0%,
  100% {
    opacity: 1;  /* 完全可见 */
  }
  92% {
    opacity: 1;  /* 保持可见 */
  }
  93% {
    opacity: 0.8;  /* 轻微变暗 */
  }
  94% {
    opacity: 1;  /* 恢复完全可见 */
  }
  96% {
    opacity: 0.9;  /* 轻微变暗 */
  }
}

.thought-text::before {
  content: " ";  /* 伪元素内容 */
  animation: matrix-flicker 0.1s infinite;  /* 无限循环的快速闪烁 */
}
</style>