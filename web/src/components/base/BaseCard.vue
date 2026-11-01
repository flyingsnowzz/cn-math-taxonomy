<script setup lang="ts">
defineProps<{ padded?: boolean }>()
</script>

<template>
  <section
    class="rounded-2xl border border-slate-200 bg-white shadow-sm"
    :class="padded === false ? '' : 'p-5'"
  >
    <slot />
  </section>
</template>
