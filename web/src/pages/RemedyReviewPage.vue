<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import RemedyQuestionPanel from '@/components/remedy/RemedyQuestionPanel.vue'
import { useRemediationStore, readDueReviewsAll } from '@/stores/remediation'
import { useDiagnoseStore } from '@/stores/diagnose'
import { normalizeSubject } from '@/data/subjectRegistry'
import { judgeAnswer, type AnswerResult } from '@/engine/engineAdapter'
import type { SubjectCode } from '@/data/types'
import type { Question } from '@/data/types'

const route = useRoute()
const remedy = useRemediationStore()
const diagnose = useDiagnoseStore()

const ready = ref(false)
const loadError = ref('')
const currentTopicId = ref<string | null>(null)
const failedTopicId = ref<string | null>(null)
const completedCount = ref(0)

const dueAll = ref<Array<{ subject: SubjectCode; topicId: string }>>([])

const subject = computed<SubjectCode>(() =>
  normalizeSubject(typeof route.query.subject === 'string' ? route.query.subject : ''),
)

const topicName = computed(() =>
  currentTopicId.value ? diagnose.graph?.byId[currentTopicId.value]?.name ?? currentTopicId.value : '',
)

const currentQuestion = computed<Question | null>(() =>
  currentTopicId.value ? remedy.reviewQuestionFor(currentTopicId.value) : null,
)

function pickNext(): void {
  failedTopicId.value = null
  const next = dueAll.value
    .slice(completedCount.value)
    .find((item) => item.subject === remedy.subject)
  currentTopicId.value = next?.topicId ?? null
}

onMounted(async () => {
  dueAll.value = readDueReviewsAll().map((item) => ({ subject: item.subject, topicId: item.topicId }))
  await diagnose.load(subject.value)
  if (diagnose.graph) remedy.attachGraph(diagnose.graph, subject.value)
  else loadError.value = diagnose.loadError || '图谱数据加载失败'
  pickNext()
  ready.value = true
})

function settle(passed: boolean) {
  if (!currentTopicId.value) return
  const id = currentTopicId.value
  remedy.answerReview(id, passed)
  if (passed) {
    completedCount.value += 1
    pickNext()
  } else {
    failedTopicId.value = id
    currentTopicId.value = null
  }
}

function skipNoQuestion() {
  completedCount.value += 1
  pickNext()
}

function onJudge(text: string) {
  if (!currentQuestion.value) return
  const verdict = judgeAnswer(currentQuestion.value, text)
  const result: AnswerResult = verdict.verdict === 'correct' ? 'correct' : 'wrong'
  settle(result === 'correct')
}

function onSelfResult(result: AnswerResult) {
  settle(result === 'correct')
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6">
    <RouterLink to="/remedy/" class="text-sm text-slate-500 hover:text-slate-700">← 返回补救计划</RouterLink>
    <h1 class="mt-3 text-xl font-semibold">今日复习</h1>

    <div v-if="loadError" class="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{{ loadError }}</div>

    <template v-else-if="ready">
      <p class="mt-1 text-sm text-slate-500" data-test="review-remaining">到期 {{ dueAll.length }} 个知识点，已完成 {{ completedCount }} 个。</p>

      <template v-if="failedTopicId">
        <div class="mt-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100" data-test="review-failed">
          <p class="text-sm font-semibold text-amber-900">复习没通过，需要重新练习</p>
          <p class="mt-1 text-sm text-amber-800">这个知识点已回到练习队列，先把它重新补扎实。</p>
          <RouterLink
            :to="`/remedy/practice/${failedTopicId}`"
            class="mt-3 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            去重新练习
          </RouterLink>
        </div>
      </template>

      <template v-else-if="currentTopicId && currentQuestion">
        <div class="mt-4 flex items-center gap-2">
          <h2 class="text-lg font-semibold">{{ topicName }}</h2>
          <BaseBadge color="#2563eb">复习</BaseBadge>
        </div>
        <div class="mt-3">
          <RemedyQuestionPanel
            :key="currentQuestion.id"
            :question="currentQuestion"
            @judge="onJudge"
            @self-result="onSelfResult"
          />
        </div>
      </template>

      <template v-else-if="currentTopicId && !currentQuestion">
        <div class="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p class="text-sm text-slate-600">这个知识点暂时没有新的复习题，以后会自动安排。</p>
          <button class="mt-3 text-sm font-medium text-teal-700 underline" @click="skipNoQuestion">看下一个</button>
        </div>
      </template>

      <template v-else>
        <div class="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200" data-test="review-done">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <p class="mt-3 font-semibold">今天的复习完成了</p>
          <p class="mt-1 text-sm text-slate-500">复习间隔按 1、3、7、15 天逐步拉长。</p>
          <RouterLink to="/remedy/" class="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">查看补救计划</RouterLink>
        </div>
      </template>
    </template>

    <div v-else class="mt-6 text-sm text-slate-500">加载中…</div>
  </div>
</template>
