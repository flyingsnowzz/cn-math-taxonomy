<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex min-h-[260px] items-center justify-center">
    <div class="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <h2 class="mb-2 text-lg font-semibold text-red-900">数据加载失败</h2>
      <p class="mb-4 text-sm text-red-700">{{ message }}</p>
      <button class="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800" @click="$emit('retry')">
        重新加载
      </button>
    </div>
  </div>
</template>
