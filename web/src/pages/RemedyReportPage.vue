<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useRemediationStore } from '@/stores/remediation'
import { useDiagnoseStore } from '@/stores/diagnose'
import {
  buildReport,
  encodePublicReport,
  formatDuration,
  toPublicReport,
  type RemedyReport,
} from '@/engine/report'
import { downloadRemedyCard } from '@/share/shareCard'
import { track } from '@/utils/track'

const remedy = useRemediationStore()
const diagnose = useDiagnoseStore()
const ready = ref(false)
const loadError = ref('')
const copied = ref(false)

onMounted(async () => {
  if (!remedy.cards.some((view) => view.topic)) {
    await diagnose.load(remedy.subject)
    if (diagnose.graph) remedy.attachGraph(diagnose.graph, remedy.subject)
    else loadError.value = diagnose.loadError || '图谱数据加载失败'
  }
  ready.value = true
})

const report = computed<RemedyReport | null>(() => {
  if (!remedy.plan || !diagnose.graph) return null
  return buildReport(remedy.plan, {
    subject: remedy.subject,
    resolveTopic: (id) => {
      const topic = diagnose.graph?.byId[id]
      return topic ? { name: topic.name, chapter: topic.chapter } : null
    },
  })
})

const shareUrl = computed(() => {
  if (!report.value) return ''
  const encoded = encodePublicReport(toPublicReport(report.value))
  return `${window.location.origin}/remedy/shared?r=${encoded}`
})

function downloadImage() {
  if (!report.value) return
  track('report_share', { kind: 'image' })
  downloadRemedyCard({ report: toPublicReport(report.value), url: shareUrl.value })
}

async function copyLink() {
  if (!shareUrl.value) return
  track('report_share', { kind: 'link' })
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // 非安全上下文没有剪贴板权限：选中链接让用户手动复制
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6">
    <RouterLink to="/remedy/" class="text-sm text-slate-500 hover:text-slate-700">← 返回补救计划</RouterLink>
    <h1 class="mt-3 text-xl font-semibold">提分报告</h1>

    <div v-if="loadError" class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{{ loadError }}</div>

    <template v-else-if="ready && report">
      <div class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p class="text-sm text-slate-500">{{ report.generatedAt }} · {{ report.targetLabel || '自适应补救' }}</p>
        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-xl bg-emerald-50 py-4">
            <div class="text-3xl font-bold text-emerald-700" data-test="report-mastered">{{ report.totals.mastered }}</div>
            <div class="mt-1 text-xs text-slate-600">已补上</div>
          </div>
          <div class="rounded-xl bg-amber-50 py-4">
            <div class="text-3xl font-bold text-amber-700">{{ report.totals.remaining }}</div>
            <div class="mt-1 text-xs text-slate-600">还在补</div>
          </div>
          <div class="rounded-xl bg-teal-50 py-4">
            <div class="text-3xl font-bold text-teal-700">{{ report.totals.questionsDone }}</div>
            <div class="mt-1 text-xs text-slate-600">已练习题</div>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-500">学习用时：{{ formatDuration(report.durationMs) }}；根因 {{ report.totals.rootsMastered }}/{{ report.totals.roots }} 已补。</p>
      </div>

      <div class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 class="font-semibold">补救路径</h2>
        <ol class="mt-3 space-y-2">
          <li
            v-for="item in report.path"
            :key="item.id"
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
            <BaseBadge v-if="item.isTarget" color="#0f766e">目标</BaseBadge>
          </li>
        </ol>
      </div>

      <div class="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 class="font-semibold">分享给家长</h2>
        <p class="mt-1 text-sm text-slate-500">分享图和链接只包含学科、章节与进度，不含个人信息。</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <BaseButton variant="primary" data-test="report-download" @click="downloadImage">下载分享图</BaseButton>
          <BaseButton data-test="report-copy" @click="copyLink">{{ copied ? '已复制链接' : '复制分享链接' }}</BaseButton>
        </div>
        <p class="mt-3 break-all text-xs leading-5 text-slate-400" data-test="report-share-url">{{ shareUrl }}</p>
      </div>
    </template>

    <div v-else-if="ready" class="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">还没有补救计划，请先完成一次诊断。</p>
      <RouterLink to="/diagnose/" class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">去诊断</RouterLink>
    </div>
    <div v-else class="mt-6 text-sm text-slate-500">加载中…</div>
  </div>
</template>
