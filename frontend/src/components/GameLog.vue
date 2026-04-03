<script setup lang="ts">
import { ScrollArea } from 'shadcn-vue'
import type { PlayerAction } from '@/types'

defineProps<{
  events: PlayerAction[]
}>()

const actionIcon = (actionType: ActionType) => {
  switch (actionType) {
    case ActionType.Kill: return '🐺💀'
    case ActionType.Save: return '🧪💚'
    case ActionType.Poison: return '🧪💀'
    case ActionType.Check: return '🔍'
    case ActionType.Speak: return '💬'
    case ActionType.Vote: return '🗳️'
    default: return '⚙️'
  }
}

const actionColor = (actionType: ActionType) => {
  switch (actionType) {
    case ActionType.Kill: return 'text-cyberwolf-red'
    case ActionType.Poison: return 'text-cyberwolf-purple'
    case ActionType.Save: return 'text-green-400'
    case ActionType.Check: return 'text-cyberwolf-blue'
    case ActionType.Speak: return 'text-yellow-300'
    case ActionType.Vote: return 'text-cyan-300'
    default: return 'text-gray-400'
  }
}
</script>

<template>
  <ScrollArea class="h-full w-full rounded-md border border-cyberwolf-blue bg-cyberwolf-dark/30">
    <div class="max-h-[500px] space-y-4">
      <div v-for="(event, index) in events" :key="index" class="p-3 border-b border-cyberwolf-blue/30 last:border-b-0">
        <div class="flex">
          <div class="text-2xl mr-3" :class="actionColor(event.actionType)">{{ actionIcon(event.actionType) }}</div>
          
          <div class="flex-1">
            <div class="font-bold" :class="event.actionType === ActionType.Kill ? 'text-cyberwolf-red' : 'text-cyberwolf-blue'">
              Player {{ event.playerId }}: {{ event.actionType }}
              <span v-if="event.targetId"> on Player {{ event.targetId }}</span>
            </div>
            
            <div class="text-cyberwolf-light text-sm my-1 italic">
              {{ event.thought }}
            </div>
            
            <div v-if="event.content" class="bg-cyberwolf-dark/50 p-2 rounded mt-1 border border-cyberwolf-blue/30">
              "{{ event.content }}"
            </div>
          </div>
        </div>
      </div>
    </div>
  </ScrollArea>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-thumb {
  background-color: theme('colors.cyberwolf.blue');
  border-radius: 3px;
}
</style>