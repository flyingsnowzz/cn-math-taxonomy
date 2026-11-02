<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import RemedyQuestionPanel from '@/components/remedy/RemedyQuestionPanel.vue'
import TopicVideoEntry from '@/components/remedy/TopicVideoEntry.vue'
import { useRemediationStore } from '@/stores/remediation'
import { useDiagnoseStore } from '@/stores/diagnose'
import { writeJson } from '@/utils/storage'
import { judgeAnswer, type AnswerResult } from '@/engine/engineAdapter'
import { track } from '@/utils/track'
import type { Question } from '@/data/types'

const route = useRoute()
const remedy = useRemediationStore()
const diagnose = useDiagnoseStore()

const ready = ref(false)
const loadError = ref('')
const feedback = ref<{ result: AnswerResult; question: Question; reason: string } | null>(null)

const SHORTFALL_KEY = 'cnmRemedy.shortfall.v1'
const practiceStarted = new Set<string>()
const lastSeenState = ref<Record<string, string>>({})

const topicId = computed(() => String(route.params.topicId ?? ''))

async function ensureGraph() {
  // 无条件保证 graph 已挂：SPA 跳转时已就绪；硬刷新时重新加载并从存储恢复计划。
  if (!remedy.cards.some((view) => view.topic)) {
    await diagnose.load(remedy.subject)
    if (diagnose.graph) remedy.attachGraph(diagnose.graph, remedy.subject)
    else loadError.value = diagnose.loadError || '图谱数据加载失败'
  }
}

onMounted(async () => {
  await ensureGraph()
  remedy.selectCard(topicId.value)
  ready.value = true
})

watch(topicId, (id) => remedy.selectCard(id))

watch(
  () => remedy.currentItem,
  (item) => {
    if (!item || item.phase !== 'practice') return
    const tid = topicId.value
    if (!practiceStarted.has(tid)) {
      practiceStarted.add(tid)
      track('practice_start', { topic: tid })
    }
  },
)

const card = computed(() => remedy.plan?.cards.find((item) => item.topicId === topicId.value) ?? null)
const topic = computed(() => diagnose.graph?.byId[topicId.value] ?? null)
const locked = computed(() => !card.value || !card.value.unlocked)
const phaseLabel = computed(() => (remedy.currentItem?.phase === 'retest' ? '复测' : '针对性练习'))

// help 状态要展示刚答错的题，保留它的快照。
const helpQuestion = ref<Question | null>(null)
const helpExplanation = computed(() => helpQuestion.value?.explanation ?? '')

function recordShortfall(id: string) {
  const raw = window.localStorage.getItem(SHORTFALL_KEY)
  const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
  if (!ids.includes(id)) {
    ids.push(id)
    writeJson(SHORTFALL_KEY, ids)
  }
}

function advance(result: AnswerResult) {
  feedback.value = null
  helpQuestion.value = null
  const topicId = topicIdValue()
  if (result !== 'correct') track('help_view', { topic: topicId })
  remedy.answerCurrent(result)
  const next = card.value
  if (result !== 'correct' && next?.state === 'help') {
    helpQuestion.value = feedbackQuestion.value
  }
  if (next?.state === 'shortfall') recordShortfall(next.topicId)
  if (next?.state === 'mastered' && lastSeenState.value[topicId] !== 'mastered') {
    track('practice_done', { topic: topicId })
    track('retest_pass', { topic: topicId })
  }
  lastSeenState.value[topicId] = next?.state ?? ''
}

function topicIdValue(): string {
  return topicId.value
}

const feedbackQuestion = ref<Question | null>(null)

function onJudge(text: string) {
  const item = remedy.currentItem
  if (!item) return
  const verdict = judgeAnswer(item.question, text)
  feedbackQuestion.value = item.question
  const result: AnswerResult = verdict.verdict === 'correct' ? 'correct' : 'wrong'
  feedback.value = { result, question: item.question, reason: verdict.reason }
  if (result === 'correct') {
    advance('correct')
  } else {
    advance('wrong')
  }
}

function onSelfResult(result: AnswerResult) {
  const item = remedy.currentItem
  if (!item) return
  feedbackQuestion.value = item.question
  feedback.value = { result, question: item.question, reason: '' }
  advance(result)
}

function continueAfterHelp() {
  helpQuestion.value = null
  remedy.resumeHelp()
  if (card.value?.state === 'shortfall') recordShortfall(card.value.topicId)
}

const nextCardHref = computed(() => {
  const next = remedy.plan?.cards.find(
    (item) => item.order > (card.value?.order ?? -1) && item.state !== 'mastered' && item.unlocked,
  )
  return next ? `/remedy/practice/${next.topicId}` : '/remedy/'
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6">
    <RouterLink to="/remedy/" class="text-sm text-slate-500 hover:text-slate-700">← 返回补救计划</RouterLink>

    <div v-if="loadError" class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ loadError }}
    </div>

    <template v-else-if="ready && remedy.plan && card">
      <template v-if="locked">
        <p class="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          这个知识点还没解锁，先完成前面的根因点。
        </p>
      </template>

      <template v-else-if="card.state === 'mastered'">
        <div class="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200" data-test="remedy-done">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <h1 class="mt-3 text-lg font-semibold">「{{ topic?.name ?? card.topicId }}」已补上</h1>
          <p class="mt-1 text-sm text-slate-500">复测通过。之后会按 1、3、7、15 天安排复习，防止遗忘。</p>
          <div class="mt-5 flex justify-center gap-3">
            <RouterLink :to="nextCardHref" class="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              下一个知识点
            </RouterLink>
            <RouterLink to="/remedy/" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              查看计划
            </RouterLink>
            <RouterLink to="/remedy/report" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              查看提分报告
            </RouterLink>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="mt-4 flex items-center gap-2">
          <h1 class="text-lg font-semibold">{{ topic?.name ?? card.topicId }}</h1>
          <BaseBadge data-test="remedy-phase" :color="phaseLabel === '复测' ? '#2563eb' : '#0f766e'">{{ phaseLabel }}</BaseBadge>
          <span v-if="remedy.currentItem" class="ml-auto text-xs text-slate-500">
            第 {{ (remedy.currentItem?.index ?? 0) + 1 }} / {{ remedy.currentItem?.total }} 题
          </span>
        </div>
        <p v-if="topic?.chapter" class="mt-0.5 text-xs text-slate-500">{{ topic.chapter }}</p>
        <TopicVideoEntry :topic-id="topicId" variant="card" />

        <!-- 答题 -->
        <div v-if="remedy.currentItem && card.state !== 'help' && !helpQuestion" class="mt-4 space-y-4">
          <RemedyQuestionPanel
            :key="remedy.currentItem.question.id"
            :question="remedy.currentItem.question"
            @judge="onJudge"
            @self-result="onSelfResult"
          />
          <div
            v-if="feedback?.result === 'correct'"
            class="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            data-test="remedy-correct"
          >
            答对了。
            <BaseButton size="sm" variant="ghost" class="ml-2 underline" @click="feedback = null">继续</BaseButton>
          </div>
        </div>

        <!-- 答错：解析与继续 -->
        <div v-else-if="helpQuestion" class="mt-4 space-y-4" data-test="remedy-help">
          <div class="rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
            <p class="text-sm font-semibold text-amber-900">这道题答错了，先看懂解析</p>
            <p v-if="helpQuestion" class="mt-2 text-[15px] leading-7">{{ helpQuestion.prompt }}</p>
            <p class="mt-2 text-sm leading-6 text-amber-900">
              <b>参考答案：</b>{{ helpQuestion?.answer }}
            </p>
            <p v-if="helpExplanation" class="mt-1 text-sm leading-6 text-amber-900">
              <b>解析：</b>{{ helpExplanation }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <BaseButton variant="primary" @click="continueAfterHelp">我看懂了，继续</BaseButton>
              <TopicVideoEntry :topic-id="topicId" variant="panel" />
            </div>
          </div>
        </div>

        <!-- 题量不足 -->
        <div v-if="card.state === 'shortfall'" class="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-test="remedy-shortfall">
          该知识点的练习/复测题即将补充。先用已有题目完成当前步骤，或返回计划稍后再来。
          <RouterLink to="/remedy/" class="ml-2 font-medium underline">返回计划</RouterLink>
        </div>

        <p class="mt-4 text-xs leading-5 text-slate-400">
          练习全对后会自动进入复测；复测答错会回到练习。所有进度保存在本设备。
        </p>
      </template>
    </template>

    <div v-else-if="ready" class="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-600">还没有补救计划，请先完成一次诊断。</p>
      <RouterLink to="/diagnose/" class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
        去诊断
      </RouterLink>
    </div>

    <div v-else class="mt-6 text-sm text-slate-500">加载中…</div>
  </div>
</template>
