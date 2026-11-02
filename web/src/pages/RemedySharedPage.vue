<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import { getSubject } from '@/data/subjectRegistry'
import { decodePublicReport, formatDuration } from '@/engine/report'

const route = useRoute()
const report = computed(() => {
  const raw = typeof route.query.r === 'string' ? route.query.r : ''
  return decodePublicReport(raw)
})
const subjectLabel = computed(() => getSubject(report.value?.subject ?? 'math').label)
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6">
    <template v-if="report">
      <div class="rounded-2xl bg-teal-700 p-6 text-white">
        <p class="text-sm text-teal-100">{{ subjectLabel }} · {{ report.generatedAt }}</p>
        <h1 class="mt-1 text-xl font-semibold">{{ report.targetLabel || '查漏补缺报告' }}</h1>
        <p class="mt-3 text-4xl font-bold" data-test="shared-mastered">{{ report.totals.mastered }}<span class="ml-2 text-base font-normal text-teal-100">个薄弱点已补上</span></p>
        <p class="mt-2 text-sm text-teal-100">还在补 {{ report.totals.remaining }} 个 · 用时 {{ formatDuration(report.durationMs) }}</p>
      </div>

      <div class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <ol class="space-y-2">
          <li
            v-for="(item, index) in report.path"
            :key="index"
            class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm"
            :class="item.mastered ? 'bg-emerald-50' : item.kind === 'weak' ? 'bg-red-50' : 'bg-amber-50'"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
              :class="item.mastered ? 'bg-emerald-600 text-white' : 'bg-white ring-1 ring-slate-300 text-slate-500'"
            >
              {{ item.mastered ? '✓' : '·' }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="font-medium">{{ item.name }}</span>
              <span v-if="item.chapter" class="ml-2 text-xs text-slate-500">{{ item.chapter }}</span>
            </span>
            <BaseBadge v-if="item.isRoot" color="#dc2626">根因</BaseBadge>
          </li>
        </ol>
      </div>

      <div class="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p class="text-sm text-slate-600">想知道孩子的薄弱根因在哪？免费做一次自适应诊断。</p>
        <RouterLink
          :to="{ path: '/diagnose/', query: report.subject === 'math' ? {} : { subject: report.subject } }"
          class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          免费诊断 →
        </RouterLink>
      </div>
    </template>

    <div v-else class="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">链接已失效或内容不完整。</p>
      <RouterLink to="/" class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">回到首页</RouterLink>
    </div>
  </div>
</template>
