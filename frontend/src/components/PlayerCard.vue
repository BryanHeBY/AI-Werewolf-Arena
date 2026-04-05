<script setup lang="ts">
// 导入Vue响应式API
import { computed } from "vue";
// 导入UI组件库组件
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// 导入游戏类型定义
import type { PublicPlayer, RoleType, Faction } from "@/types";
// 导入角色图标组件
import { Skull, Eye, FlaskConical, User } from "lucide-vue-next";

// 定义组件属性
const props = defineProps<{
  player: PublicPlayer; // 玩家信息对象
  isThinking?: boolean; // 是否正在思考（显示思考动画）
}>();

/**
 * 计算属性：根据玩家角色类型获取对应的图标组件
 * 用于在卡片中显示不同角色的视觉标识
 */
const roleIcon = computed(() => {
  const roleType = String(props.player?.roleType || "villager") as RoleType;
  switch (roleType) {
    case "wolf": // 狼人角色
      return Skull; // 骷髅图标，象征危险和攻击性
    case "seer": // 预言家角色
      return Eye; // 眼睛图标，象征洞察和预言
    case "witch": // 女巫角色
      return FlaskConical; // 药水瓶图标，象征药剂和魔法
    default: // 默认村民角色
      return User; // 用户图标，象征普通玩家
  }
});

/**
 * 计算属性：获取发光效果CSS类
 * 根据玩家阵营添加不同的霓虹发光效果
 */
const glowClass = computed(() => {
  if (!props.player?.isAlive) return ""; // 如果玩家已死亡，不显示发光效果

  const faction = String(props.player?.faction || "villager") as Faction;
  switch (faction) {
    case "wolf": // 狼人阵营
      return "shadow-glow-red border-neon-red"; // 红色霓虹发光和边框
    case "villager": // 村民阵营
      return "shadow-glow-blue border-neon-blue"; // 蓝色霓虹发光和边框
    default: // 其他阵营
      return "";
  }
});

/**
 * 计算属性：获取思考状态CSS类
 * 当玩家正在思考时，显示呼吸动画和强青色发光效果
 */
const thinkingClass = computed(() => {
  if (!props.isThinking) return "";
  return "breathing shadow-glow-cyan-strong"; // 呼吸动画 + 强青色发光
});

/**
 * 计算属性：根据阵营获取文字颜色类
 * 用于区分不同阵营的文字颜色
 */
const factionColor = computed(() => {
  if (!props.player?.isAlive) return "text-gray-500"; // 死亡玩家显示灰色

  const faction = String(props.player?.faction || "villager") as Faction;
  switch (faction) {
    case "wolf": // 狼人阵营
      return "text-neon-red"; // 红色霓虹文字
    case "villager": // 村民阵营
      return "text-neon-blue"; // 蓝色霓虹文字
    default: // 其他阵营
      return "text-text"; // 默认文字颜色
  }
});

/**
 * 计算属性：获取徽章变体类型
 * 用于根据阵营和存活状态显示不同的徽章样式
 */
const badgeVariant = computed(() => {
  if (!props.player?.isAlive) return "dead"; // 死亡玩家显示死亡样式

  const faction = String(props.player?.faction || "villager") as Faction;
  switch (faction) {
    case "wolf": // 狼人阵营
      return "wolf"; // 狼人样式徽章
    case "villager": // 村民阵营
      return "villager"; // 村民样式徽章
    default: // 其他阵营
      return "outline"; // 轮廓样式徽章
  }
});

/**
 * 计算属性：生成完整的卡片CSS类
 * 组合多个样式类，包括基础样式、发光效果、思考动画、死亡状态等
 */
const cardClass = computed(() => {
  const base = "bg-surface transition-all duration-300"; // 基础样式 + 过渡动画
  const glow = glowClass.value; // 阵营发光效果
  const thinking = thinkingClass.value; // 思考状态动画
  const dead = !props.player?.isAlive ? "opacity-50 grayscale" : ""; // 死亡状态：半透明 + 灰度
  const glitch = !props.player?.isAlive ? "glitch-effect" : ""; // 死亡状态：故障效果
  return `${base} ${glow} ${thinking} ${dead} ${glitch}`; // 组合所有样式类
});

// 计算属性：获取玩家名称（防止空值）
const playerName = computed(() => props.player?.name || "未知玩家");
// 计算属性：获取玩家ID（默认值0）
const playerId = computed(() => props.player?.id ?? 0);
// 计算属性：获取角色类型字符串
const roleType = computed(() => String(props.player?.roleType || "villager"));
// 计算属性：获取阵营字符串
const faction = computed(() => String(props.player?.faction || "villager"));

/**
 * 根据角色类型英文名称获取中文名称
 * @param roleType - 角色类型英文名称
 * @returns 角色中文名称
 */
const getRoleChinese = (roleType: string): string => {
  switch (roleType.toLowerCase()) {
    case "wolf": // 狼人
      return "狼人";
    case "seer": // 预言家
      return "预言家";
    case "witch": // 女巫
      return "女巫";
    case "villager": // 村民
      return "村民";
    default: // 其他角色
      return roleType;
  }
};

/**
 * 根据阵营英文名称获取中文名称
 * @param faction - 阵营英文名称
 * @returns 阵营中文名称
 */
const getFactionChinese = (faction: string): string => {
  switch (faction.toLowerCase()) {
    case "wolf": // 狼人阵营
      return "狼人阵营";
    case "villager": // 好人（村民）阵营
      return "好人阵营";
    default: // 其他阵营
      return faction;
  }
};

/**
 * 计算属性：获取阵营中文大写缩写
 * 用于在徽章或小空间内显示阵营标识
 */
const factionChineseAbbr = computed(() => {
  switch (faction.value.toLowerCase()) {
    case "wolf": // 狼人阵营
      return "🐺 狼"; // 狼表情 + "狼"字
    case "villager": // 好人阵营
      return "👥 好"; // 人群表情 + "好"字
    default: // 其他阵营
      return faction.value.toUpperCase(); // 显示大写英文
  }
});
</script>

<template>
  <!-- 玩家卡片容器 -->
  <Card
    :class="cardClass"
    class="relative overflow-hidden group"
    :data-testid="`player-${playerId}`"
  >
    <!-- 卡片头部：显示玩家ID、名称和角色徽章 -->
    <CardHeader class="pb-3">
      <div class="flex items-center justify-between">
        <!-- 左侧：玩家ID和名称 -->
        <div class="flex items-center gap-2">
          <!-- 玩家ID圆圈：显示玩家ID，颜色根据阵营变化 -->
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
            :class="[
              props.player?.isAlive ? 'bg-surfaceHover' : 'bg-black', // 存活时悬停背景，死亡时黑色背景
              factionColor, // 文字颜色根据阵营变化
            ]"
          >
            {{ playerId }}
          </div>
          <!-- 玩家名称 -->
          <div>
            <h3 class="font-mono text-sm font-semibold" :class="factionColor">
              {{ playerName }}
            </h3>
          </div>
        </div>

        <!-- 右侧：角色徽章，显示角色中文名称 -->
        <Badge :variant="badgeVariant" class="font-mono text-xs">
          {{ getRoleChinese(roleType) }}
        </Badge>
      </div>
    </CardHeader>

    <!-- 卡片内容：显示角色图标和阵营信息 -->
    <CardContent class="pt-0">
      <!-- 角色图标和阵营信息区域 -->
      <div class="flex items-center gap-2 mt-2">
        <!-- 角色图标组件，根据角色类型动态渲染 -->
        <component
          :is="roleIcon"
          :size="16"
          :class="[
            props.player?.isAlive ? factionColor : 'text-gray-500', // 存活时使用阵营颜色，死亡时灰色
            isThinking ? 'animate-pulse' : '', // 思考时显示脉冲动画
          ]"
        />
        <!-- 阵营中文名称 -->
        <span class="text-xs font-mono text-textMuted">
          {{ getFactionChinese(faction) }}
        </span>
      </div>

      <!-- 思考状态指示器：当玩家正在思考时显示 -->
      <div
        v-if="isThinking"
        class="absolute top-0 right-0 w-2 h-2 bg-neon-cyan rounded-full animate-pulse shadow-glow-cyan"
      ></div>
    </CardContent>
  </Card>
</template>
