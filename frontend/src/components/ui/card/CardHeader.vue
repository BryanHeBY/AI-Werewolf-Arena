
/**
 * Card 头部容器：用于标题、摘要等头部信息布局。
 */
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    :class="
      cn('flex flex-col space-y-1.5 p-6', props.class)
    "
  >
    <slot />
  </div>
</template>
