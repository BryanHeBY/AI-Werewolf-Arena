
/**
 * 轻量滚动容器：统一包裹可滚动区域并透传样式。
 */
<script setup lang="ts">
import { computed } from 'vue'
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
