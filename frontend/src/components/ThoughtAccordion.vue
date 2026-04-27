<script setup lang="ts">
// 导入Vue响应式API
import { ref, computed } from "vue";
// 导入图标组件
import { ChevronDown } from "lucide-vue-next";
// 定义组件属性
const props = defineProps<{
  msg: {
    senderId?: number;
    playerId?: number;
    privateThought?: string;
    [key: string]: any;
  }; // 聊天消息对象，包含内心独白信息
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
    .replace(/^思考：/, "") // 移除中文前缀"思考："
    .replace(/^Thinking: /, "") // 移除英文前缀"Thinking: "
    .replace(/<thinking>/g, "") // 移除<thinking>标签
    .replace(/<\/thinking>/g, "") // 移除</thinking>标签
    .trim(); // 移除首尾空白字符
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
    <!-- 头部按钮：点击展开/收起折叠面板 - 简洁小字样式 -->
    <button
      @click="toggle"
      class="accordion-header w-full text-left bg-surface/50 hover:bg-surface/70 rounded-lg p-2 flex items-center justify-between gap-2 transition-all duration-200 group"
    >
      <!-- 按钮内容：简洁标题 + 箭头图标 -->
      <div class="flex items-center gap-2">
        <ChevronDown
          :size="14"
          :class="[
            'text-textMuted transition-transform duration-200',
            isExpanded ? 'rotate-180' : '',
          ]"
        />
        <span
          class="font-mono text-xs text-textMuted group-hover:text-text transition-colors duration-200"
        >
          {{ isExpanded ? "隐藏思考过程" : "显示思考过程" }}
        </span>
      </div>
    </button>

    <!-- 折叠面板内容区域 -->
    <div v-if="isExpanded" class="thought-content mt-2 overflow-hidden">
      <div
        class="bg-surface/30 border border-border rounded-lg p-3 font-mono text-xs leading-relaxed"
      >
        <div class="text-textMuted mb-1 text-[10px]">推理过程:</div>
        <div class="thought-text text-text whitespace-pre-wrap break-words">
          {{ formattedThought }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 简单的展开/收起动画 */
.thought-content {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
