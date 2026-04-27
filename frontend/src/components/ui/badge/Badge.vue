<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { Primitive } from 'radix-vue'
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        outline: 'text-foreground',
        wolf: 'border-neon-red text-neon-red bg-neon-red/10 shadow-glow-red',
        villager: 'border-neon-blue text-neon-blue bg-neon-blue/10 shadow-glow-blue',
        witch: 'border-neon-purple text-neon-purple bg-neon-purple/10 shadow-glow-purple',
        dead: 'border-gray-600 text-gray-500 bg-gray-900/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const props = defineProps<{
  class?: HTMLAttributes['class']
  variant?: VariantProps<typeof badgeVariants>['variant']
}>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <Primitive
    v-bind="delegatedProps"
    :class="cn(badgeVariants({ variant }), props.class)"
  >
    <slot />
  </Primitive>
</template>
