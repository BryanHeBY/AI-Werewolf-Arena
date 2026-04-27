<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  class?: any
  orientation?: 'horizontal' | 'vertical'
}>(), {
  orientation: 'vertical',
})
</script>

<template>
  <div
    :class="cn(
      'relative overflow-hidden',
      props.class
    )"
  >
    <div class="h-full w-full rounded-[inherit] overflow-auto">
      <slot />
    </div>
  </div>
</template>
