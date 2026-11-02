<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import RemedyCard from '@/components/remedy/RemedyCard.vue'
import { useRemediationStore, readDueReviewsAll } from '@/stores/remediation'
import { useDiagnoseStore } from '@/stores/diagnose'
import type { SubjectCode } from '@/data/types'

const remedy = useRemediationStore()
const diagnose = useDiagnoseStore()
const ready = ref(false)
const loadError = ref('')
const dueCounts = ref<Record<string, number>>({})

onMounted(async () => {
  // 同一次 SPA 会话里 graph 在 startFromSummary 时已挂好；硬刷新进来则重新加载学科包，
  // 并从 localStorage 恢复计划（此时 store 里的 plan 还是 null）。
  if (!remedy.cards.some((view) => view.topic)) {
    await diagnose.load(remedy.subject)
    if (diagnose.graph) remedy.attachGraph(diagnose.graph, remedy.subject)
    else loadError.value = diagnose.loadError || '图谱数据加载失败'
  }
  const counts: Record<string, number> = {}
  for (const due of readDueReviewsAll()) counts[due.subject] = (counts[due.subject] ?? 0) + 1
  dueCounts.value = counts
  ready.value = true
})

const dueForSubject = computed(() => dueCounts.value[remedy.subject] ?? 0)
const dueTotal = computed(() => Object.values(dueCounts.value).reduce((sum, n) => sum + n, 0))

const diagnoseHref = {
  path: '/diagnose/',
  query: (remedy.subject === 'math' ? {} : { subject: remedy.subject }) as Record<string, string>,
}
const reviewHref = {
  path: '/remedy/review',
  query: (remedy.subject === 'math' ? {} : { subject: remedy.subject as SubjectCode }) as Record<string, string>,
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">补救计划</h1>
      <RouterLink
        v-if="ready && remedy.plan"
        to="/remedy/report"
        class="text-sm font-medium text-teal-700 hover:text-teal-800"
        data-test="remedy-report-link"
      >
        提分报告 →
      </RouterLink>
    </div>

    <div v-if="loadError" class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ loadError }}
    </div>

    <RouterLink
      v-if="dueTotal > 0"
      :to="reviewHref"
      class="mt-4 block rounded-2xl bg-blue-700 p-5 text-white shadow-sm"
      data-test="remedy-review-banner"
    >
      <p class="font-semibold">今日复习：{{ dueTotal }} 个知识点到期</p>
      <p class="mt-1 text-sm text-blue-100">
        本学科 {{ dueForSubject }} 个{{ dueTotal !== dueForSubject ? ` · 全部学科 ${dueTotal} 个` : '' }}，花几分钟巩固一下。
      </p>
    </RouterLink>

    <template v-if="ready && remedy.plan">
      <div class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">总进度</span>
          <span class="text-slate-500" data-test="remedy-progress">
            已补上 {{ remedy.progress?.mastered ?? 0 }} / {{ remedy.progress?.total ?? 0 }}
          </span>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <span
            class="block h-full rounded-full bg-emerald-500 transition-all"
            :style="{ width: `${remedy.progress?.percent ?? 0}%` }"
          />
        </div>
        <p class="mt-2 text-xs leading-5 text-slate-500">
          按学习路径从根因补起：每个知识点先做针对性练习，练完自动复测，复测通过后解锁下一个。
        </p>
      </div>

      <ol class="mt-4 space-y-3">
        <RemedyCard v-for="view in remedy.cards" :key="view.card.topicId" :view="view" />
      </ol>
    </template>

    <div v-else-if="ready" class="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">还没有补救计划。先做一次诊断，找出薄弱点。</p>
      <RouterLink
        :to="diagnoseHref"
        class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        去诊断
      </RouterLink>
    </div>
  </div>
</template>
