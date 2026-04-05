<script setup lang="ts">
// 导入UI组件库
import { Card, CardContent, CardHeader } from "shadcn-vue";
import { Badge } from "shadcn-vue";
// 导入游戏类型定义
import { RoleType, Faction } from "@/types";
import type { PublicPlayer } from "@/types";

// 定义组件属性
defineProps<{
  players: PublicPlayer[]; // 玩家列表，由父组件传入
}>();

/**
 * 根据角色类型获取对应的图标和背景颜色
 * @param roleType - 角色类型枚举
 * @returns 包含图标和颜色类的对象
 */
const roleIcon = (roleType: RoleType) => {
  switch (roleType) {
    case RoleType.Wolf: // 狼人角色
      return {
        icon: "🐺", // 狼人图标
        color: "bg-cyberwolf-red", // 红色背景，表示狼人阵营
      };
    case RoleType.Seer: // 预言家角色
      return {
        icon: "🔮", // 水晶球图标
        color: "bg-cyberwolf-blue", // 蓝色背景，表示村民阵营
      };
    case RoleType.Witch: // 女巫角色
      return {
        icon: "🧪", // 药水瓶图标
        color: "bg-cyberwolf-purple", // 紫色背景，表示特殊角色
      };
    default: // 默认村民角色
      return {
        icon: "👨‍🌾", // 农民图标
        color: "bg-gray-500", // 灰色背景
      };
  }
};

/**
 * 根据阵营获取对应的CSS样式类
 * @param faction - 阵营枚举（狼人或村民）
 * @returns 对应的边框和阴影样式类
 */
const factionClass = (faction: Faction) => {
  return faction === Faction.Wolf // 如果是狼人阵营
    ? "border-cyberwolf-red shadow-neon-red" // 红色边框和红色霓虹阴影
    : "border-cyberwolf-blue shadow-neon-blue"; // 蓝色边框和蓝色霓虹阴影
};
</script>

<template>
  <!-- 玩家网格容器：响应式网格布局 -->
  <div
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-cyberwolf-dark/80 overflow-y-auto"
  >
    <!-- 遍历所有玩家，为每个玩家创建一个卡片 -->
    <Card
      v-for="player in players"
      :key="player.id"
      class="relative backdrop-blur-sm bg-cyberwolf-dark/60"
      :class="[
        factionClass(player.faction),
        { 'thinking-animation': player.isActive },
      ]"
    >
      <!-- 卡片头部：显示玩家名称、阵营标识和角色图标 -->
      <CardHeader>
        <div class="flex items-center justify-between">
          <!-- 玩家名称 -->
          <h3 class="text-xl font-bold">{{ player.name }}</h3>

          <!-- 右侧标识区域：阵营徽章 + 角色图标 -->
          <div class="flex items-center gap-2">
            <!-- 阵营徽章：根据阵营显示不同颜色 -->
            <Badge
              class="px-3"
              :class="
                player.faction === Faction.Wolf
                  ? 'bg-cyberwolf-red'
                  : 'bg-cyberwolf-blue'
              "
            >
              {{ player.faction }}
            </Badge>

            <!-- 角色图标：圆形背景 + 表情符号 -->
            <div
              :class="
                roleIcon(player.roleType).color +
                ' w-8 h-8 rounded-full flex items-center justify-center'
              "
            >
              {{ roleIcon(player.roleType).icon }}
            </div>
          </div>
        </div>
      </CardHeader>

      <!-- 卡片内容：显示玩家详细状态信息 -->
      <CardContent>
        <div class="flex flex-col gap-2">
          <!-- 存活状态：显示玩家是存活还是死亡 -->
          <div class="flex items-center">
            <span class="text-sm text-cyberwolf-light mr-2">Status:</span>
            <span
              :class="player.isAlive ? 'text-green-400' : 'text-cyberwolf-red'"
            >
              {{ player.isAlive ? "ALIVE" : "DEAD" }}
            </span>
          </div>

          <!-- 角色类型：如果玩家不是村民，显示具体角色类型 -->
          <div v-if="player.roleType !== RoleType.Villager" class="text-sm">
            <p class="text-cyberwolf-light truncate">
              {{ player.roleType.toLowerCase() }}
            </p>
          </div>
        </div>
      </CardContent>

      <!-- 死亡遮罩：如果玩家已死亡，显示半透明遮罩和"DEAD"文字 -->
      <div
        v-if="!player.isAlive"
        class="absolute inset-0 bg-black/70 flex items-center justify-center"
      >
        <span class="text-2xl font-bold text-cyberwolf-red">DEAD</span>
      </div>
    </Card>
  </div>
</template>

<style scoped>
/* 卡片基础样式 */
.card {
  border: 1px solid;
  border-radius: 8px;
  transition: all 0.3s ease; /* 平滑过渡效果 */
}
</style>
