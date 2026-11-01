<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md'
    disabled?: boolean
  }>(),
  { variant: 'secondary', size: 'md', disabled: false },
)
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
      variant === 'primary' && 'bg-teal-700 text-white hover:bg-teal-800',
      variant === 'secondary' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
    ]"
  >
    <slot />
  </button>
</template>
