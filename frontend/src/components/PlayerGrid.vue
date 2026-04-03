<script setup lang="ts">
import { Card, CardContent, CardHeader } from 'shadcn-vue'
import { Badge } from 'shadcn-vue'
import { RoleType, Faction } from '@/types'
import type { PublicPlayer } from '@/types'

defineProps<{
  players: PublicPlayer[]
}>()

const roleIcon = (roleType: RoleType) => {
  switch (roleType) {
    case RoleType.Wolf: return { icon: '🐺', color: 'bg-cyberwolf-red' }
    case RoleType.Seer: return { icon: '🔮', color: 'bg-cyberwolf-blue' }
    case RoleType.Witch: return { icon: '🧪', color: 'bg-cyberwolf-purple' }
    default: return { icon: '👨‍🌾', color: 'bg-gray-500' }
  }
}

const factionClass = (faction: Faction) => {
  return faction === Faction.Wolf 
    ? 'border-cyberwolf-red shadow-neon-red' 
    : 'border-cyberwolf-blue shadow-neon-blue'
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-cyberwolf-dark/80 overflow-y-auto">
    <Card 
      v-for="player in players" 
      :key="player.id"
      class="relative backdrop-blur-sm bg-cyberwolf-dark/60"
      :class="[factionClass(player.faction), { 'thinking-animation': player.isActive }]"
    >
      <CardHeader>
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">{{ player.name }}</h3>
          
          <div class="flex items-center gap-2">
            <Badge 
              class="px-3" 
              :class="player.faction === Faction.Wolf ? 'bg-cyberwolf-red' : 'bg-cyberwolf-blue'"
            >
              {{ player.faction }}
            </Badge>
            
            <div :class="roleIcon(player.roleType).color + ' w-8 h-8 rounded-full flex items-center justify-center'">
              {{ roleIcon(player.roleType).icon }}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div class="flex flex-col gap-2">
          <div class="flex items-center">
            <span class="text-sm text-cyberwolf-light mr-2">Status:</span>
            <span :class="player.isAlive ? 'text-green-400' : 'text-cyberwolf-red'">
              {{ player.isAlive ? 'ALIVE' : 'DEAD' }}
            </span>
          </div>
          
          <div v-if="player.roleType !== RoleType.Villager" class="text-sm">
            <p class="text-cyberwolf-light truncate">
              {{ player.roleType.toLowerCase() }}
            </p>
          </div>
        </div>
      </CardContent>
      
      <div v-if="!player.isAlive" class="absolute inset-0 bg-black/70 flex items-center justify-center">
        <span class="text-2xl font-bold text-cyberwolf-red">DEAD</span>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid;
  border-radius: 8px;
  transition: all 0.3s ease;
}
</style>