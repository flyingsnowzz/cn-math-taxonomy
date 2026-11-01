<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <div class="flex min-h-[260px] items-center justify-center">
    <div class="text-center">
      <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
      <p class="text-sm font-medium text-slate-700">{{ message ?? '正在加载知识图谱数据…' }}</p>
    </div>
  </div>
</template>
