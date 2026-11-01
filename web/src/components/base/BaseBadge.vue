<script setup lang="ts">
defineProps<{ color?: string }>()
</script>

<template>
  <span
    class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
    :style="color ? { backgroundColor: `${color}1a`, color } : undefined"
  >
    <slot />
  </span>
</template>
