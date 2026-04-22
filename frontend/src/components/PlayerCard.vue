/**
 * 玩家卡片组件：展示单个玩家的身份、阵营、生死状态与思考指示灯。
 */
<script setup lang="ts">
import { computed } from "vue";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PublicPlayer, RoleType, Faction } from "@/types";
import { Skull, Eye, FlaskConical, User } from "lucide-vue-next";

const props = defineProps<{
  player: PublicPlayer;
  isThinking?: boolean;
}>();

const roleIcon = computed(() => {
  const roleType = String(props.player?.roleType || "villager") as RoleType;
  switch (roleType) {
    case "wolf":
      return Skull;
    case "seer":
      return Eye;
    case "witch":
      return FlaskConical;
    default:
      return User;
  }
});

// 根据玩家阵营决定卡片发光与边框样式，方便一眼区分阵营态势。
const glowClass = computed(() => {
  if (!props.player?.isAlive) return "";
  const faction = String(props.player?.faction || "villager") as Faction;
  switch (faction) {
    case "wolf":
      return "shadow-glow-red border-neon-red";
    case "villager":
      return "shadow-glow-blue border-neon-blue";
    default:
      return "";
  }
});

const thinkingClass = computed(() => {
  if (!props.isThinking) return "";
  return "breathing shadow-glow-cyan-strong";
});

const factionColor = computed(() => {
  if (!props.player?.isAlive) return "text-gray-500";
  const faction = String(props.player?.faction || "villager") as Faction;
  switch (faction) {
    case "wolf":
      return "text-neon-red";
    case "villager":
      return "text-neon-blue";
    default:
      return "text-text";
  }
});

const badgeVariant = computed(() => {
  if (!props.player?.isAlive) return "dead";
  const faction = String(props.player?.faction || "villager") as Faction;
  switch (faction) {
    case "wolf":
      return "wolf";
    case "villager":
      return "villager";
    default:
      return "outline";
  }
});

const cardClass = computed(() => {
  const base = "bg-surface transition-all duration-300";
  const glow = glowClass.value;
  const thinking = thinkingClass.value;
  const dead = !props.player?.isAlive ? "opacity-50 grayscale" : "";
  const glitch = !props.player?.isAlive ? "glitch-effect" : "";
  return `${base} ${glow} ${thinking} ${dead} ${glitch}`;
});

const playerName = computed(() => props.player?.name || "未知玩家");
const playerId = computed(() => props.player?.id ?? 0);
const roleType = computed(() => String(props.player?.roleType || "villager"));
const faction = computed(() => String(props.player?.faction || "villager"));

// 把角色英文标识映射为中文展示文案。
const getRoleChinese = (roleType: string): string => {
  switch (roleType.toLowerCase()) {
    case "wolf":
      return "狼人";
    case "seer":
      return "预言家";
    case "witch":
      return "女巫";
    case "villager":
      return "村民";
    default:
      return roleType;
  }
};

// 把阵营英文标识映射为中文展示文案。
const getFactionChinese = (faction: string): string => {
  switch (faction.toLowerCase()) {
    case "wolf":
      return "狼人阵营";
    case "villager":
      return "好人阵营";
    default:
      return faction;
  }
};

// 用于头像旁边的阵营简写标识。
const factionChineseAbbr = computed(() => {
  switch (faction.value.toLowerCase()) {
    case "wolf":
      return "🐺 狼";
    case "villager":
      return "👥 好";
    default:
      return faction.value.toUpperCase();
  }
});
</script>

<template>
  <Card
    :class="cardClass"
    class="relative overflow-hidden group"
    :data-testid="`player-${playerId}`"
  >
    <CardHeader class="pb-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
            :class="[
              props.player?.isAlive ? 'bg-surfaceHover' : 'bg-black',
              factionColor,
            ]"
          >
            {{ playerId }}
          </div>
          <div>
            <h3 class="font-mono text-sm font-semibold" :class="factionColor">
              {{ playerName }}
            </h3>
          </div>
        </div>

        <Badge :variant="badgeVariant" class="font-mono text-xs">
          {{ getRoleChinese(roleType) }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="pt-0">
      <div class="flex items-center gap-2 mt-2">
        <component
          :is="roleIcon"
          :size="16"
          :class="[
            props.player?.isAlive ? factionColor : 'text-gray-500',
            isThinking ? 'animate-pulse' : '',
          ]"
        />
        <span class="text-xs font-mono text-textMuted">
          {{ getFactionChinese(faction) }}
        </span>
      </div>

      <div
        v-if="isThinking"
        class="absolute top-0 right-0 w-2 h-2 bg-neon-cyan rounded-full animate-pulse shadow-glow-cyan"
      ></div>
    </CardContent>
  </Card>
</template>
