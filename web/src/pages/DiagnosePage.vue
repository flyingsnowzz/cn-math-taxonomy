<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ErrorState from '@/components/base/ErrorState.vue'
import LoadingState from '@/components/base/LoadingState.vue'
import { formatGradeForSubject, getSubject, normalizeSubject, subjectFromTopicId } from '@/data/subjectRegistry'
import { standardItems } from '@/data/guards'
import { useDiagnoseStore } from '@/stores/diagnose'
import { useChildrenStore } from '@/stores/children'
import { useBlindspotsStore } from '@/stores/blindspots'
import { useRemediationStore } from '@/stores/remediation'
import { remedyEnabled } from '@/utils/feature'
import { track } from '@/utils/track'
import BaseButton from '@/components/base/BaseButton.vue'
import { useDiagnosticSettingsStore } from '@/stores/diagnosticSettings'
import KnowledgeGraph from '@/components/graph/KnowledgeGraph.vue'
import QuestionFigure from '@/components/QuestionFigure.vue'
import { foldDiagnosticLayout, graphFromDiagnosticLayout } from '@/components/graph/graphAdapter'
import type { ChildDiagnosticRecord } from '@/children/legacy/children'
import { downloadShareCard } from '@/share/shareCard'
import type { CurriculumStandardItem, Question, SubjectCode } from '@/data/types'
import { buildDiagnosticLayout, type AnswerResult } from '@/engine/engineAdapter'

const route = useRoute()
const router = useRouter()
const diagnose = useDiagnoseStore()
const childrenStore = useChildrenStore()
const blindspotsStore = useBlindspotsStore()
const settingsStore = useDiagnosticSettingsStore()
const diagnosticSettings = ref(settingsStore.read())
const queryConfirm = computed(() => {
  const value = Number(route.query.confirm)
  return settingsStore.confirmChoices.includes(value as 2 | 3 | 5) ? (value as 2 | 3 | 5) : undefined
})
const blindNotedKey = ref('')
const remediation = useRemediationStore()

// 补救入口：path 中 weak/shaky 的知识点数量；demo 模式不建计划。
const remedyCount = computed(() =>
  diagnose.summary?.path.filter((item) => item.status === 'weak' || item.status === 'shaky').length ?? 0,
)
const isDemoDiagnosis = computed(() => route.query.demo === '1')
const remedyOn = remedyEnabled()
const trackedDoneSeed = ref('')
const usedQuestionIds = computed(() =>
  (diagnose.session?.answers ?? [])
    .map((answer) => answer.qid)
    .filter((qid): qid is string => !!qid),
)

watch(
  () => diagnose.session,
  (session) => {
    if (session && session.answers.length === 0 && !isDemoDiagnosis.value) {
      track('diagnose_start', { subject: subject.value })
    }
  },
)
watch(
  () => diagnose.summary,
  (summaryValue) => {
    if (summaryValue && !isDemoDiagnosis.value && diagnose.session?.seed !== trackedDoneSeed.value) {
      trackedDoneSeed.value = diagnose.session?.seed ?? ''
      track('diagnose_done', {
        subject: subject.value,
        weak: summaryValue.weak.length,
        shaky: summaryValue.shaky.length,
      })
    }
  },
)

function startRemedy() {
  if (!diagnose.graph || !diagnose.summary || remedyCount.value === 0) return
  remediation.startFromSummary(
    diagnose.graph,
    diagnose.summary,
    usedQuestionIds.value,
    subject.value,
    diagnose.session?.seed,
  )
  void router.push('/remedy/')
}

const searchText = ref('')
const numericAnswer = ref('')
const quickScopes = computed(() => diagnose.chapterTree.volumes.map((volume) => volume.volume))
type AnswerPhase = 'ask' | 'auto' | 'manual' | 'skip'
const answerPhase = ref<AnswerPhase>('ask')
const submittedAnswer = ref('')
const pendingResult = ref<AnswerResult | null>(null)
const autoStartedKey = ref('')

const subject = computed<SubjectCode>(() => normalizeSubject(route.query.subject))
const currentQuestion = computed<Question | null>(() => diagnose.currentItem?.question ?? null)
const currentTopicId = computed(() => diagnose.currentItem?.topicId ?? '')
const currentTopic = computed(() =>
  currentTopicId.value ? diagnose.graph?.byId[currentTopicId.value] : undefined,
)
const progressPercent = computed(() => {
  if (!diagnose.session) return 0
  return Math.round((diagnose.session.answers.length / diagnose.session.limit) * 100)
})

const diagnosticLayout = computed(() => {
  if (!diagnose.graph || !diagnose.session || !diagnose.summary) return null
  return buildDiagnosticLayout(diagnose.graph, diagnose.session, diagnose.summary)
})
const pathExpanded = ref(false)
const pathGraph = computed(() => {
  if (!diagnose.graph || !diagnosticLayout.value) return { topics: [], edges: [] }
  if (diagnosticLayout.value.nodes.length <= 40 || pathExpanded.value) {
    return graphFromDiagnosticLayout(diagnose.graph.topics, diagnosticLayout.value)
  }
  return foldDiagnosticLayout(
    diagnose.graph.topics,
    diagnosticLayout.value,
    (grade) => formatGradeForSubject(subject.value, grade),
  )
})


const pathStatusById = computed(() => new Map(
  diagnosticLayout.value?.nodes.map((node) => [node.id, node.status]) ?? [],
))
const rootIds = computed(() => new Set(
  diagnosticLayout.value?.nodes.filter((node) => node.isRoot).map((node) => node.id) ?? [],
))
const targetIds = computed(() => new Set(
  diagnosticLayout.value?.nodes.filter((node) => node.isTarget).map((node) => node.id) ?? [],
))
const masteredSource = computed<Record<string, 'direct' | 'inferred'>>(() => {
  const entries = diagnose.summary?.mastered
    .map((id) => [id, diagnose.session?.status[id]?.src ?? 'direct'] as const)
    ?? []
  return Object.fromEntries(entries)
})
const resultStandards = computed(() => {
  const result = diagnose.summary
  if (!result || !diagnose.session) return [] as Array<CurriculumStandardItem & { topicNames: string[] }>
  const topicIds = new Set([
    ...result.path.map((item) => item.id),
    ...result.targets,
    ...result.roots.map((root) => root.id),
  ])
  const standardTopics = new Map<string, string[]>()
  for (const id of topicIds) {
    const topic = diagnose.graph?.byId[id]
    for (const ref of topic?.standards ?? []) {
      const names = standardTopics.get(ref.id) ?? []
      names.push(topic?.name ?? id)
      standardTopics.set(ref.id, names)
    }
  }
  return standardItems(diagnose.standards)
    .filter((item) => standardTopics.has(item.id))
    .map((item) => ({ ...item, topicNames: [...new Set(standardTopics.get(item.id) ?? [])] }))
})
const answerRows = computed(() => {
  const activeSession = diagnose.session
  if (!activeSession) return []
  return activeSession.answers.map((answer, index) => ({
    index,
    answer,
    question: answer.qid ? diagnose.questionById.get(answer.qid) : null,
  }))
})
const answerResultOptions: Array<{ value: AnswerResult; label: string }> = [
  { value: 'correct', label: '答对' },
  { value: 'wrong', label: '答错' },
  { value: 'skip', label: '不会 / 跳过' },
]

function updateAnswerResult(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value as AnswerResult
  diagnose.correctAnswer(index, value)
}

const resultHeadline = computed(() => {
  const result = diagnose.summary
  const activeSession = diagnose.session
  if (!result || !activeSession) return ''

  if (result.mode === 'screen') {
    if (result.weak.length === 0 && result.shaky.length === 0) {
      return result.untested.length
        ? `已测到的知识点没有发现薄弱点，另有 ${result.untested.length} 个没测到。`
        : '范围内的知识点都已掌握，没有发现薄弱点。'
    }
    return `范围内共 ${activeSession.targets.length} 个知识点：薄弱 ${result.weak.length}、不稳 ${result.shaky.length}、未测 ${result.untested.length}。先看下面的按章汇总，薄弱的章排在前面。`
  }

  const targetsMastered = activeSession.targets.every((id) => result.mastered.includes(id))
  if (result.roots.length === 0 && result.shaky.length === 0 && targetsMastered) {
    return '目标知识点已掌握，没有发现需要补的先修。'
  }
  if (result.roots.length === 0 && result.shaky.length === 0) {
    return '没有判出薄弱点，但目标尚未全部测到。'
  }
  if (result.roots.length === 0) {
    return `没有判出薄弱点，但有 ${result.shaky.length} 个知识点「不稳」（中途答错过、确认题答对），建议巩固。`
  }
  return `共发现 ${result.roots.length} 个薄弱根因${result.shaky.length ? `、${result.shaky.length} 个不稳的知识点` : ''}，按下面的学习路径从前往后补。`
})
const unconfirmedNames = computed(() => diagnose.summary?.unconfirmed.map((id) => diagnose.nameOf(id)) ?? [])
const outOfScopeRoots = computed(() =>
  diagnose.summary?.roots.filter((root) => root.outOfScopePrereqs.length > 0) ?? [],
)

function prerequisiteNames(ids: string[]): string {
  return ids.map((id) => diagnose.nameOf(id)).join('」「')
}

const savedToProfile = ref(false)
const savedSessionVersion = ref(0)
const savedSession = computed(() => {
  void savedSessionVersion.value
  return diagnose.readSavedSession()
})

function continueSavedSession() {
  if (savedSession.value && diagnose.restore(savedSession.value)) {
    answerPhase.value = 'ask'
    bumpSavedSessionVersion()
  }
}

async function discardSavedSession() {
  diagnose.clearSavedSession()
  await Promise.resolve()
  savedSessionVersion.value += 1
}

const selectableTopics = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  const topics = diagnose.graph?.topics ?? []
  return topics
    .filter((topic) => {
      if (!query) return true
      return `${topic.id} ${topic.name} ${topic.chapter}`.toLowerCase().includes(query)
    })
    .slice(0, 120)
})

const filteredChapterTree = computed(() => {
  const query = searchText.value.trim().toLowerCase()
  if (!query) return diagnose.chapterTree.volumes
  return diagnose.chapterTree.volumes
    .map((volume) => ({
      ...volume,
      chapters: volume.chapters
        .map((chapter) => ({
          ...chapter,
          topics: chapter.topics.filter((item) => {
            const chapterHit = chapter.label.toLowerCase().includes(query)
            if (chapterHit) return true
            const text = `${item.topic.id} ${item.topic.name} ${item.topic.chapter} ${item.topic.description ?? ''}`.toLowerCase()
            return text.includes(query)
          }),
        }))
        .filter((chapter) => chapter.topics.length > 0),
    }))
    .filter((volume) => volume.chapters.length > 0)
})


function currentDiagnosticOptions() {
  return {
    limit: diagnosticSettings.value.limit,
    confirm: queryConfirm.value ?? diagnosticSettings.value.confirm,
  }
}

function updateDiagnosticSetting<K extends keyof typeof diagnosticSettings.value>(
  key: K,
  value: (typeof diagnosticSettings.value)[K],
) {
  diagnosticSettings.value = settingsStore.save({ [key]: value })
}

function updateTargetLimit(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  updateDiagnosticSetting('limit', value)
}

function updateScreenLimit(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  updateDiagnosticSetting('screenLimit', value)
}

function updateConfirm(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (value === 2 || value === 3 || value === 5) updateDiagnosticSetting('confirm', value)
}

async function initialize() {
  answerPhase.value = 'ask'
  submittedAnswer.value = ''
  pendingResult.value = null
  savedToProfile.value = false
  autoStartedKey.value = ''
  blindNotedKey.value = ''
  searchText.value = ''
  pathExpanded.value = false
  diagnose.resetSessionState()
  const rawTarget = String(route.query.target ?? '')
  const firstRawTarget = rawTarget.split(',')[0]?.trim() ?? ''
  const inferred = subjectFromTopicId(firstRawTarget)
  if (inferred && inferred !== subject.value) {
    await router.replace({ query: { ...route.query, subject: inferred } })
    return
  }

  await diagnose.load(subject.value)
  const rawTargets = rawTarget
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const targets = rawTargets.length ? diagnose.resolveTargetIds(rawTargets) : []
  const validTargets = targets.filter((id) => Boolean(diagnose.graph?.byId[id]))
  const scope = String(route.query.grade ?? route.query.volume ?? '')
  const chapterKey = typeof route.query.chapter === 'string' ? route.query.chapter : ''
  const startKey = `${subject.value}:${validTargets.join(',')}:${scope}:${chapterKey}:${String(route.query.demo ?? '')}`
  if (autoStartedKey.value === startKey) return

  if (validTargets.length) {
    const saved = diagnose.readSavedSession()
    const sameSaved = saved && saved.targets.join(',') === validTargets.join(',')
    if (sameSaved && saved && route.query.demo !== '1' && diagnose.restore(saved)) {
      autoStartedKey.value = startKey
      return
    }

    const limit = Number(route.query.limit ?? 0)
    const seed = typeof route.query.seed === 'string' ? route.query.seed : undefined
    if (route.query.demo === '1') diagnose.startDemo(validTargets)
    else diagnose.start(validTargets, undefined, {
      ...currentDiagnosticOptions(),
      limit: Number.isFinite(limit) && limit > 0 ? limit : diagnosticSettings.value.limit,
      seed,
    })
    autoStartedKey.value = startKey
    return
  }

  if (chapterKey && diagnose.startChapter(chapterKey)) {
    autoStartedKey.value = startKey
    return
  }

  if (scope) {
    const scopeLimit = Number(route.query.limit ?? 0)
    const scopeSeed = typeof route.query.seed === 'string' ? route.query.seed : undefined
    if (diagnose.startGradeScope(scope, {
      limit: Number.isFinite(scopeLimit) && scopeLimit > 0 ? scopeLimit : diagnosticSettings.value.screenLimit,
      confirm: queryConfirm.value ?? diagnosticSettings.value.confirm,
      seed: scopeSeed,
    })) {
      autoStartedKey.value = startKey
    }
  }
}

function printResult() {
  window.print()
}
function downloadResultPoster() {
  if (!diagnose.summary) return
  downloadShareCard({
    subject: subject.value,
    scope: diagnose.label,
    summary: diagnose.summary,
    nameOf: (id) => diagnose.nameOf(id),
    chapters: diagnose.chapterSummaries,
    url: window.location.origin,
  })
}


function exportResultJson() {
  const activeSession = diagnose.session
  const result = diagnose.summary
  if (!activeSession || !result) return
  const brief = (id: string) => ({ id, name: diagnose.nameOf(id) })

  const payload = {
    tool: 'cn-math-taxonomy/diagnose',
    version: 2,
    mode: result.mode,
    generatedAt: new Date().toISOString(),
    subject: subject.value,
    note: '自动判题是近似的，以参考答案为准。',
    label: diagnose.label,
    targets: result.targets.map(brief),
    limit: activeSession.limit,
    seed: activeSession.seed,
    asked: result.asked,
    finished: result.finished,
    limitReached: result.limitReached,
    answers: answerRows.value.map((row) => ({
      order: row.index + 1,
      topicId: row.answer.id,
      name: diagnose.nameOf(row.answer.id),
      questionId: row.answer.qid,
      difficulty: row.question?.difficulty,
      type: row.question?.type,
      prompt: row.question?.prompt,
      userAnswer: row.answer.text == null ? null : row.answer.text,
      result: row.answer.result,
      referenceAnswer: row.question?.answer,
      explanation: row.question?.explanation ?? '',
    })),
    chapters: diagnose.chapterSummaries.length
      ? diagnose.chapterSummaries.map((chapter) => ({
        label: chapter.label,
        total: chapter.total,
        mastered: chapter.mastered,
        shaky: chapter.shaky,
        weak: chapter.weak,
        untested: chapter.untested,
        weakTopics: chapter.weakIds.map(brief),
        shakyTopics: chapter.shakyIds.map(brief),
        untestedTopics: chapter.untestedIds.map(brief),
      }))
      : undefined,
    weakRoots: result.roots.map((root) => ({
      ...brief(root.id),
      pendingPrereqs: root.pendingPrereqs,
      outOfScopePrereqs: root.outOfScopePrereqs,
      externalPrereqs: root.externalPrereqs,
      masteryCriteria: diagnose.graph?.byId[root.id]?.mastery_criteria ?? [],
      standards: diagnose.graph?.byId[root.id]?.standards?.map((item) => item.id) ?? [],
    })),
    path: result.path.map((item, index) => ({
      order: index + 1,
      ...brief(item.id),
      status: item.status,
      isRoot: item.isRoot,
      isTarget: item.isTarget,
    })),
    weak: result.weak.map(brief),
    shaky: result.shaky.map(brief),
    mastered: result.mastered.map((id) => ({
      ...brief(id),
      source: activeSession.status[id]?.src ?? 'direct',
    })),
    untested: result.untested.map((id) => ({
      ...brief(id),
      external: Boolean(diagnose.graph?.byId[id]?.external),
    })),
    standards: resultStandards.value.map((standard) => ({ id: standard.id, text: standard.text })),
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `diagnosis-${subject.value}-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function saveToProfile() {
  const result = diagnose.summary
  const child = childrenStore.current
  if (!result || !diagnose.session || !child) return
  const now = new Date().toISOString()
  const record: ChildDiagnosticRecord = {
    key: `${subject.value}|${diagnose.session.seed}|${result.targets.join(',')}`,
    subject: subject.value,
    label: diagnose.label,
    mode: result.mode,
    targets: result.targets,
    asked: result.asked,
    counts: {
      mastered: result.mastered.length,
      shaky: result.shaky.length,
      weak: result.weak.length,
      untested: result.untested.length,
    },
    weak: result.weak,
    roots: result.roots.map((root) => root.id),
    shaky: result.shaky,
    mastered: result.mastered,
    savedAt: now,
    updatedAt: now,
  }
  childrenStore.saveRecord(child.id, record)
  savedToProfile.value = true
}

function bumpSavedSessionVersion() {
  savedSessionVersion.value += 1
}

function startTopic(id: string) {
  numericAnswer.value = ''
  answerPhase.value = 'ask'
  submittedAnswer.value = ''
  pendingResult.value = null
  if (id) {
    diagnose.start([id], undefined, currentDiagnosticOptions())
    bumpSavedSessionVersion()
  }
}

function startChapterFromBrowser(key: string) {
  numericAnswer.value = ''
  answerPhase.value = 'ask'
  diagnose.startChapter(key, currentDiagnosticOptions())
  bumpSavedSessionVersion()
}

function startScope(scope: string) {
  numericAnswer.value = ''
  answerPhase.value = 'ask'
  diagnose.startGradeScope(scope, {
    limit: diagnosticSettings.value.screenLimit,
    confirm: diagnosticSettings.value.confirm,
  })
  bumpSavedSessionVersion()
}

function resetFeedback() {
  answerPhase.value = 'ask'
  pendingResult.value = null
  submittedAnswer.value = ''
  numericAnswer.value = ''
}

function referenceAnswer(question: Question): string {
  if (question.type === 'choice') {
    const choice = question.choices?.find((item) => item.key === question.answer)
    return choice ? `${question.answer}. ${choice.text}` : question.answer
  }
  return question.answer
}

function displaySubmittedAnswer(question: Question): string {
  if (question.type !== 'choice') return submittedAnswer.value
  const choice = question.choices?.find((item) => item.key === submittedAnswer.value)
  return choice ? `${choice.key}. ${choice.text}` : submittedAnswer.value
}

function prepareVerdict(answer: string) {
  const question = currentQuestion.value
  if (!question) return
  const verdict = diagnose.judge(question, answer)
  submittedAnswer.value = answer
  if (verdict.manual) {
    answerPhase.value = 'manual'
    pendingResult.value = null
  } else {
    answerPhase.value = 'auto'
    pendingResult.value = verdict.result
  }
}

function commit(result: AnswerResult, answer?: string) {
  diagnose.submit(result, answer)
  resetFeedback()
}

function choose(choice: string) {
  if (answerPhase.value !== 'ask') return
  prepareVerdict(choice)
}

function submitNumeric() {
  const answer = numericAnswer.value.trim()
  if (!currentQuestion.value || !answer || answerPhase.value !== 'ask') return
  prepareVerdict(answer)
}

function prepareManualSelfEvaluation() {
  if (!currentQuestion.value) return
  answerPhase.value = 'manual'
  submittedAnswer.value = numericAnswer.value.trim()
  pendingResult.value = null
}

function prepareSkip() {
  if (!currentQuestion.value) return
  if (currentQuestion.value.type === 'self') {
    prepareManualSelfEvaluation()
    return
  }
  submittedAnswer.value = ''
  pendingResult.value = 'skip'
  answerPhase.value = 'skip'
}

function continueAfterFeedback() {
  if (!pendingResult.value) return
  commit(pendingResult.value, submittedAnswer.value || undefined)
}

function selfEvaluate(result: AnswerResult) {
  commit(result, submittedAnswer.value || numericAnswer.value || undefined)
}

function flipPendingResult(result: AnswerResult) {
  pendingResult.value = result
}


function switchSubject(code: SubjectCode) {
  void router.push({ path: '/diagnose/', query: { subject: code } })
}

const answerKey = computed(() =>
  diagnose.currentItem ? `${diagnose.currentItem.topicId}#${diagnose.currentItem.attempt}` : '',
)
watch(answerKey, () => resetFeedback())

watch(
  () => diagnose.summary,
  (summary) => {
    if (!summary || !diagnose.session || route.query.demo === '1') return
    const key = `${subject.value}:${diagnose.session.seed}:${summary.targets.join(',')}:${summary.asked}`
    if (blindNotedKey.value === key) return
    blindspotsStore.noteResult({
      subject: subject.value,
      label: diagnose.label,
      key,
      demo: false,
      answers: diagnose.session.answers,
      summary,
    })
    blindNotedKey.value = key
  },
  { immediate: true },
)

function openResultDetailsForPrint() {
  document.querySelectorAll<HTMLDetailsElement>('.print-area details:not([open])').forEach((details) => {
    details.open = true
    details.dataset.autoOpen = '1'
  })
}

function closeResultDetailsAfterPrint() {
  document.querySelectorAll<HTMLDetailsElement>('details[data-auto-open]').forEach((details) => {
    details.open = false
    delete details.dataset.autoOpen
  })
}

watch(subject, () => {
  void initialize()
})
onMounted(() => {
  window.addEventListener('beforeprint', openResultDetailsForPrint)
  window.addEventListener('afterprint', closeResultDetailsAfterPrint)
  void initialize()
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', openResultDetailsForPrint)
  window.removeEventListener('afterprint', closeResultDetailsAfterPrint)
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ getSubject(subject).label }}自适应诊断</h1>
        <p class="mt-1 text-sm text-slate-500">从目标知识点开始，沿 hard / soft 先修关系定位薄弱根因。</p>
      </div>
      <div class="grid flex-wrap grid-cols-4 gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:flex">
        <button
          v-for="code in ['math','english','physics','chinese','science','morality','history','geography'] as SubjectCode[]"
          :key="code"
          type="button"
          class="rounded-lg px-2 py-1.5 text-xs font-medium sm:px-3"
          :class="code === subject ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="switchSubject(code)"
        >
          {{ getSubject(code).label }}
        </button>
      </div>
    </div>

    <LoadingState v-if="diagnose.graph === null && !diagnose.loadError" message="正在加载诊断题库…" />
    <ErrorState v-else-if="diagnose.loadError" :message="diagnose.loadError" @retry="initialize" />

    <template v-else>
      <section v-if="!diagnose.session" class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div class="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <input
            v-model="searchText"
            type="search"
            placeholder="搜索知识点、章节或 ID"
            class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <p class="text-xs text-slate-500">{{ selectableTopics.length }} / {{ diagnose.graph?.topics.length ?? 0 }} 个知识点</p>
          <div class="max-h-[30vh] space-y-1 overflow-y-auto pr-1 xl:max-h-[58vh]">
            <button
              v-for="topic in selectableTopics"
              :key="topic.id"
              class="w-full rounded-xl p-3 text-left transition hover:bg-teal-50"
              @click="startTopic(topic.id)"
            >
              <span class="block text-sm font-semibold">{{ topic.name }}</span>
              <span class="mt-1 block truncate text-xs text-slate-500">{{ topic.chapter }}</span>
            </button>
          </div>
        </div>

        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold">教材章节目录</h2>
            <span class="text-xs text-slate-500">可按整章诊断</span>
          </div>
          <div class="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
            <details
              v-for="volume in filteredChapterTree"
              :key="volume.volume"
              class="rounded-2xl border border-slate-200 bg-slate-50/60 p-3"
              :open="Boolean(searchText)"
            >
              <summary class="cursor-pointer select-none text-sm font-semibold text-slate-800">
                {{ volume.volume }}
              </summary>
              <div class="mt-3 space-y-3">
                <section
                  v-for="chapter in volume.chapters"
                  :key="chapter.key"
                  class="rounded-xl bg-white p-3 ring-1 ring-slate-200"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-sm font-semibold">{{ chapter.label }}</h3>
                      <p class="mt-0.5 text-xs text-slate-500">{{ chapter.topics.length }} 个知识点</p>
                    </div>
                    <button
                      class="shrink-0 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                      @click="startChapterFromBrowser(chapter.key)"
                    >
                      整章诊断
                    </button>
                  </div>
                  <div class="mt-2 grid gap-1 sm:grid-cols-2">
                    <button
                      v-for="item in chapter.topics"
                      :key="item.topic.id"
                      class="rounded-lg px-2 py-1.5 text-left text-xs hover:bg-teal-50"
                      @click="startTopic(item.topic.id)"
                    >
                      <span class="font-medium">{{ item.topic.name }}</span>
                      <span v-if="item.section" class="ml-1 text-slate-400">{{ item.section }}</span>
                    </button>
                  </div>
                </section>
              </div>
            </details>
            <p v-if="filteredChapterTree.length === 0" class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              没有匹配的章节或知识点。
            </p>
          </div>
        </div>

        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="mb-3 text-base font-semibold">诊断设置</h2>
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="text-xs font-medium text-slate-600">
              单点/整章题量上限
              <input
                type="number"
                min="8"
                max="30"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                :value="diagnosticSettings.limit"
                @change="updateTargetLimit"
              />
            </label>
            <label class="text-xs font-medium text-slate-600">
              整体筛查题量上限
              <input
                type="number"
                min="20"
                max="60"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                :value="diagnosticSettings.screenLimit"
                @change="updateScreenLimit"
              />
            </label>
            <label class="text-xs font-medium text-slate-600">
              每知识点确认题数
              <select
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                :value="diagnosticSettings.confirm"
                @change="updateConfirm"
              >
                <option v-for="count in settingsStore.confirmChoices" :key="count" :value="count">{{ count }} 题</option>
              </select>
            </label>
          </div>
          <p class="mt-2 text-xs leading-5 text-slate-500">设置保存在本机 localStorage；连续答对指定题数才判掌握，题库不足时以题库数量为准。</p>
        </div>

        <div v-if="savedSession" class="rounded-2xl border border-teal-200 bg-teal-50 p-4 shadow-sm">
          <h2 class="text-base font-semibold text-teal-950">继续上次诊断</h2>
          <p class="mt-1 text-sm text-teal-800">
            {{ savedSession.label }} · 已答 {{ savedSession.answers.length }} 题
          </p>
          <div class="mt-3 flex gap-2">
            <button class="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800" @click="continueSavedSession">
              继续
            </button>
            <button class="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50" @click="discardSavedSession">
              放弃存档
            </button>
          </div>
        </div>

        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 class="mb-3 text-base font-semibold">快速整体诊断</h2>
          <p class="text-sm leading-6 text-slate-500">也可以选择年级或册次进入筛查模式。筛查范围限制在本册内容内，范围外先修将在结果中提示。</p>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="scope in quickScopes"
              :key="scope"
              class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-teal-50"
              @click="startScope(scope)"
            >
              {{ scope }}
            </button>
          </div>
        </div>
      </section>

      <template v-else-if="diagnose.currentItem && currentQuestion && currentTopic">
        <section class="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>{{ diagnose.label }}</span>
            <span>第 {{ diagnose.session.answers.length + 1 }} 题 / 上限 {{ diagnose.session.limit }}</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-teal-600 transition-all" :style="{ width: `${progressPercent}%` }" />
          </div>

          <div class="mt-7">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                {{ currentTopic.grade }} 年级 · {{ currentTopic.domain }}
              </span>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                第 {{ diagnose.currentItem.attempt }} 次确认
              </span>
              <span v-if="currentQuestion.difficulty" class="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
                {{ currentQuestion.difficulty }}
              </span>
            </div>
            <h2 class="text-xl font-semibold leading-8">{{ currentQuestion.prompt }}</h2>
          </div>

          <QuestionFigure v-if="currentQuestion.figure" :svg="currentQuestion.figure" />

          <div v-if="answerPhase === 'ask' && currentQuestion.type === 'choice' && currentQuestion.choices" class="mt-6 grid gap-3">
            <button
              v-for="choice in currentQuestion.choices"
              :key="choice.key"
              :class="[`flex ${choice.figure && !currentQuestion.hideChoiceText ? 'flex-wrap' : 'items-center'} gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm transition hover:border-teal-300 hover:bg-teal-50`]"
              @click="choose(choice.key)"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold">{{ choice.key }}</span>
              <span v-if="!currentQuestion.hideChoiceText || !choice.figure">{{ choice.text }}</span>
              <QuestionFigure
                v-if="choice.figure"
                :svg="choice.figure"
                :class="currentQuestion.hideChoiceText ? 'max-w-[96px] flex-1' : 'w-full basis-full'"
              />
            </button>
          </div>

          <div v-else-if="answerPhase === 'ask' && currentQuestion.type === 'self'" class="mt-6">
            <label class="mb-2 block text-sm font-medium text-slate-700">开放作答</label>
            <textarea
              v-model="numericAnswer"
              rows="4"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="开放题：可以写下自己的思路（不会自动判分），再点「看参考答案并自评」"
            />
            <div class="mt-3">
              <button class="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800" @click="prepareManualSelfEvaluation">
                看参考答案并自评
              </button>
            </div>
          </div>

          <div v-else-if="answerPhase === 'ask'" class="mt-6">
            <label for="diagnosis-answer-input" class="mb-2 block text-sm font-medium text-slate-700">输入答案</label>
            <div class="flex gap-2">
              <input
                id="diagnosis-answer-input"
                v-model="numericAnswer"
                class="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                @keyup.enter="submitNumeric"
              />
              <button class="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800" @click="submitNumeric">
                提交
              </button>
            </div>
          </div>

          <div
            v-if="answerPhase !== 'ask'"
            class="mt-6 rounded-2xl p-4 text-sm leading-6"
            :class="answerPhase === 'auto' && pendingResult === 'correct'
              ? 'bg-emerald-50 text-emerald-950'
              : answerPhase === 'auto'
                ? 'bg-red-50 text-red-950'
                : 'bg-amber-50 text-amber-950'"
          >
            <p v-if="answerPhase === 'auto'" class="font-semibold">
              {{ pendingResult === 'correct' ? '自动判定：正确' : '自动判定：不正确' }}
            </p>
            <p v-else-if="answerPhase === 'skip'" class="font-semibold">你选择了「不会」，先查看答案和解析。</p>
            <p v-else class="font-semibold">系统无法可靠判定这道题，请对照参考答案手动确认。</p>
            <p v-if="submittedAnswer" class="mt-1">你的答案：{{ displaySubmittedAnswer(currentQuestion) }}</p>
            <p class="mt-1"><b>参考答案：</b>{{ referenceAnswer(currentQuestion) }}</p>
            <p v-if="currentQuestion.explanation" class="mt-1"><b>解析：</b>{{ currentQuestion.explanation }}</p>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-if="answerPhase === 'auto'"
                class="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                @click="continueAfterFeedback"
              >
                下一题
              </button>
              <button
                v-if="answerPhase === 'auto'"
                class="rounded-lg border border-current/20 px-3 py-2 text-xs font-semibold"
                @click="flipPendingResult(pendingResult === 'correct' ? 'wrong' : 'correct')"
              >
                {{ pendingResult === 'correct' ? '判错了，我其实没做对' : '判错了，我其实做对了' }}
              </button>
              <template v-if="answerPhase === 'manual'">
                <button class="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" @click="selfEvaluate('correct')">我答对了</button>
                <button class="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white" @click="selfEvaluate('wrong')">不对</button>
                <button class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white" @click="selfEvaluate('skip')">不会</button>
              </template>
              <button
                v-if="answerPhase === 'skip'"
                class="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                @click="continueAfterFeedback"
              >
                下一题
              </button>
              <button class="rounded-lg border border-current/20 px-3 py-2 text-xs font-semibold" @click="resetFeedback">重新作答</button>
            </div>
          </div>

          <div class="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              class="text-sm font-medium text-slate-500 hover:text-red-700 disabled:opacity-40"
              :disabled="answerPhase !== 'ask'"
              @click="prepareSkip"
            >
              不会 / 跳过
            </button>
            <button class="text-sm font-medium text-slate-500 hover:text-slate-900" :disabled="diagnose.session.answers.length === 0" @click="diagnose.undo(); resetFeedback()">
              撤销上一题
            </button>
          </div>
        </section>
      </template>

      <section v-else-if="diagnose.summary" class="print-area space-y-5">
        <div class="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p class="text-sm font-medium text-teal-700">诊断结果：{{ diagnose.label }}</p>
          <h2 class="mt-2 text-2xl font-bold">共作答 {{ diagnose.summary.asked }} 题</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ resultHeadline }}</p>
          <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-2xl bg-emerald-50 p-4"><b class="block text-2xl">{{ diagnose.summary.mastered.length }}</b>已掌握</div>
            <div class="rounded-2xl bg-amber-50 p-4"><b class="block text-2xl">{{ diagnose.summary.shaky.length }}</b>不稳</div>
            <div class="rounded-2xl bg-red-50 p-4"><b class="block text-2xl">{{ diagnose.summary.weak.length }}</b>薄弱</div>
            <div class="rounded-2xl bg-slate-100 p-4"><b class="block text-2xl">{{ diagnose.summary.untested.length }}</b>未测</div>
          </div>

          <p
            v-if="unconfirmedNames.length"
            class="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          >
            「{{ unconfirmedNames.join('」「') }}」答错过但还没完成确认就到了题量上限，没来得及复测，暂按薄弱处理。
          </p>
          <p v-if="diagnose.summary.limitReached" class="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            已达到题量上限（{{ diagnose.summary.limit }}），未测到的知识点标为“未测”。薄弱根因的先修中若有未测点，真正根因可能更靠前。
            <button
              v-if="diagnose.summary.limit < 60"
              class="ml-3 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              @click="diagnose.extendSession()"
            >
              再多答 {{ Math.min(10, 60 - diagnose.summary.limit) }} 题
            </button>
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white" @click="diagnose.restart()">重新诊断</button>
            <button class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" @click="printResult">打印结果</button>
            <button class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" @click="downloadResultPoster">生成分享图</button>
            <button class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" @click="exportResultJson">导出 JSON</button>
            <button class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold" :disabled="diagnose.session?.answers.length === 0" @click="diagnose.undo()">
              撤销上一题
            </button>
            <RouterLink
              to="/children/"
              class="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800"
            >
              选择孩子档案
            </RouterLink>
            <button
              v-if="childrenStore.current"
              class="min-w-0 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-800"
              :disabled="savedToProfile"
              @click="saveToProfile"
            >
              {{ savedToProfile ? '已保存到当前档案' : '保存到当前孩子档案' }}
            </button>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 class="mb-3 font-semibold text-red-800">薄弱根因</h3>
            <ul class="space-y-2 text-sm">
              <li v-for="root in diagnose.summary.roots" :key="root.id" class="space-y-2 rounded-xl bg-red-50 px-3 py-3">
                <span class="font-semibold">{{ diagnose.nameOf(root.id) }}</span>
                <span
                  v-if="root.pendingPrereqs.length"
                  class="block rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900"
                >
                  它的先修「{{ prerequisiteNames(root.pendingPrereqs) }}」没来得及测（题量用完），真正的根因可能更靠前。
                </span>
                <span
                  v-if="root.outOfScopePrereqs.length"
                  class="block rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900"
                >
                  它的前置知识「{{ prerequisiteNames(root.outOfScopePrereqs) }}」不在所选范围内，没有检查。
                </span>
                <span
                  v-if="root.externalPrereqs.length"
                  class="block text-xs leading-5 text-slate-500"
                >
                  无诊断题先修（未测）：{{ prerequisiteNames(root.externalPrereqs) }}
                </span>
              </li>
              <li v-if="diagnose.summary.roots.length === 0" class="text-slate-500">未发现薄弱根因。</li>
            </ul>
          </div>
          <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 class="mb-3 font-semibold">建议学习路径</h3>
            <ol class="space-y-2 text-sm">
              <li
                v-for="(item, index) in diagnose.summary.path"
                :key="item.id"
                class="flex gap-3 rounded-xl px-3 py-2"
                :class="item.status === 'weak' ? 'bg-red-50' : item.status === 'shaky' ? 'bg-amber-50' : 'bg-slate-50'"
              >
                <span class="font-semibold text-slate-400">{{ index + 1 }}</span>
                <span>{{ diagnose.nameOf(item.id) }}</span>
              </li>
            </ol>
          </div>
        </div>

        <section
          v-if="remedyOn && remedyCount > 0 && !isDemoDiagnosis"
          class="rounded-2xl bg-teal-700 p-5 text-white shadow-sm"
          data-test="remedy-cta"
        >
          <h3 class="text-lg font-semibold">开始针对性补救</h3>
          <p class="mt-1 text-sm leading-6 text-teal-50">
            共 {{ remedyCount }} 个薄弱或不稳的知识点。按学习路径逐个练习，每个点练完自动复测，确认补上再进下一个。
          </p>
          <BaseButton variant="secondary" class="mt-3" @click="startRemedy">
            开始补救（{{ remedyCount }} 个薄弱点）
          </BaseButton>
        </section>

        <section v-if="diagnose.chapterSummaries.length" class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="font-semibold">按章汇总</h3>
            <span class="text-xs text-slate-500">薄弱章节排在前面</span>
          </div>
          <p class="mb-3 text-xs leading-5 text-slate-500">
            每章的知识点掌握情况；色条从左到右表示掌握、不稳、薄弱、未测。
          </p>
          <p
            v-if="outOfScopeRoots.length"
            class="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
          >
            部分薄弱点的前置知识在所选年级之外，未检查（涉及 {{ outOfScopeRoots.length }} 个薄弱点，如「{{ outOfScopeRoots.slice(0, 3).map((root) => diagnose.nameOf(root.id)).join('」「') }}」）。可对这些知识点单独诊断，沿先修继续往前查。
          </p>
          <div class="grid gap-2 md:grid-cols-2">
            <details
              v-for="chapter in diagnose.chapterSummaries"
              :key="chapter.key"
              class="rounded-xl border border-slate-200 p-3"
              :open="chapter.weak > 0 || chapter.shaky > 0"
            >
              <summary class="cursor-pointer">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold">{{ chapter.volume }} · {{ chapter.label }}</p>
                    <p class="mt-0.5 text-xs text-slate-500">{{ chapter.total }} 个知识点</p>
                  </div>
                  <div class="shrink-0 text-right text-xs">
                    <span class="mr-1 text-emerald-700">{{ chapter.mastered }} 掌握</span>
                    <span class="mr-1 text-amber-700">{{ chapter.shaky }} 不稳</span>
                    <span class="mr-1 text-red-700">{{ chapter.weak }} 薄弱</span>
                    <span class="text-slate-500">{{ chapter.untested }} 未测</span>
                  </div>
                </div>
                <div class="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  <span class="bg-emerald-500" :style="{ width: `${chapter.total ? (chapter.mastered / chapter.total) * 100 : 0}%` }" />
                  <span class="bg-amber-400" :style="{ width: `${chapter.total ? (chapter.shaky / chapter.total) * 100 : 0}%` }" />
                  <span class="bg-red-500" :style="{ width: `${chapter.total ? (chapter.weak / chapter.total) * 100 : 0}%` }" />
                  <span class="bg-slate-300" :style="{ width: `${chapter.total ? (chapter.untested / chapter.total) * 100 : 0}%` }" />
                </div>
              </summary>
              <div class="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                <div v-if="chapter.weakIds.length" class="flex flex-wrap items-center gap-2">
                  <span class="mr-1 font-semibold text-red-700">薄弱</span>
                  <span>{{ chapter.weakIds.map((id) => diagnose.nameOf(id)).join('、') }}</span>
                  <RouterLink
                    class="rounded bg-red-50 px-2 py-1 font-medium text-red-700 hover:bg-red-100"
                    :to="{ path: '/diagnose/', query: { subject, target: chapter.weakIds.join(',') } }"
                  >
                    再测本章薄弱
                  </RouterLink>
                </div>
                <div v-if="chapter.shakyIds.length" class="mt-2 flex flex-wrap items-center gap-2">
                  <span class="mr-1 font-semibold text-amber-700">不稳</span>
                  <span>{{ chapter.shakyIds.map((id) => diagnose.nameOf(id)).join('、') }}</span>
                  <RouterLink
                    class="rounded bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100"
                    :to="{ path: '/diagnose/', query: { subject, target: chapter.shakyIds.join(',') } }"
                  >
                    再测本章不稳
                  </RouterLink>
                </div>
                <p v-if="!chapter.weakIds.length && !chapter.shakyIds.length">
                  {{ chapter.untested ? `没有发现薄弱或不稳的点，另有 ${chapter.untested} 个没测到。` : '没有发现薄弱或不稳的点。' }}
                </p>
              </div>
            </details>
          </div>
        </section>

        <p v-if="diagnosticLayout && diagnosticLayout.nodes.length > 40" class="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          <template v-if="!pathExpanded">路径较长，已按年级收起中间知识点；根因和目标仍单独画出。</template>
          <template v-else>已展开全部 {{ diagnosticLayout.nodes.length }} 个知识点。</template>
          <button class="ml-2 font-semibold text-teal-700 hover:underline" type="button" @click="pathExpanded = !pathExpanded">
            {{ pathExpanded ? '按年级收起' : `展开全部 ${diagnosticLayout.nodes.length} 个` }}
          </button>
        </p>

        <KnowledgeGraph
          v-if="pathGraph.topics.length"
          :topics="pathGraph.topics"
          :edges="pathGraph.edges"
          :selected-id="diagnose.summary.targets[0] ?? pathGraph.topics[0]?.id ?? ''"
          :subject="subject"
          :status-by-id="pathStatusById"
          :root-ids="rootIds"
          :target-ids="targetIds"
          class="mt-4 min-h-[360px] sm:min-h-[420px]"
        />

        <section class="grid gap-4 lg:grid-cols-2">
          <details class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <summary class="cursor-pointer font-semibold">已掌握的知识点（{{ diagnose.summary.mastered.length }}）</summary>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <li v-for="id in diagnose.summary.mastered" :key="id" class="flex flex-wrap gap-2 rounded-xl bg-emerald-50 px-3 py-2">
                <span>{{ diagnose.nameOf(id) }}</span>
                <span class="text-xs text-emerald-700">{{ masteredSource[id] === 'inferred' ? '由后续知识点答对推断' : '直接答对' }}</span>
              </li>
              <li v-if="!diagnose.summary.mastered.length" class="text-slate-500">无。</li>
            </ul>
          </details>
          <details class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <summary class="cursor-pointer font-semibold">未测的知识点（{{ diagnose.summary.untested.length }}）</summary>
            <ul class="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <li v-for="id in diagnose.summary.untested" :key="id" class="rounded-xl bg-slate-100 px-3 py-2">{{ diagnose.nameOf(id) }}</li>
              <li v-if="!diagnose.summary.untested.length" class="text-slate-500">无。</li>
            </ul>
          </details>
        </section>

        <section v-if="resultStandards.length" class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 class="font-semibold">关联课标条目</h3>
          <div class="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <div v-for="standard in resultStandards" :key="standard.id" class="rounded-xl bg-slate-50 p-3">
              <b>{{ standard.id }}</b>
              <p class="mt-1">{{ standard.text }}</p>
              <p class="mt-1 text-xs text-slate-500">对应知识点：{{ standard.topicNames.join('、') }}</p>
            </div>
          </div>
        </section>

        <section class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 class="font-semibold">答题记录（可更正）</h3>
          <p class="mt-1 text-xs leading-5 text-slate-500">自动判题可能判错。修改某题结果后，会用原有确定性引擎重新计算后续状态和学习路径。</p>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <th class="py-2 pr-3">#</th>
                  <th class="py-2 pr-3">知识点 / 题目</th>
                  <th class="py-2 pr-3">你的答案</th>
                  <th class="py-2 pr-3">结果</th>
                  <th class="py-2 pr-3">参考答案</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in answerRows" :key="`${row.answer.qid}-${row.index}`" class="border-t border-slate-100">
                  <td class="py-2 pr-3 text-slate-400">{{ row.index + 1 }}</td>
                  <td class="py-2 pr-3">
                    <b>{{ diagnose.nameOf(row.answer.id) }}</b>
                    <span class="mt-0.5 block max-w-80 truncate text-xs text-slate-500">{{ row.question?.prompt ?? '' }}</span>
                  </td>
                  <td class="py-2 pr-3 text-slate-600">{{ row.answer.text || '—' }}</td>
                  <td class="py-2 pr-3">
                    <select
                      class="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      :value="row.answer.result"
                      @change="updateAnswerResult(row.index, $event)"
                    >
                      <option v-for="option in answerResultOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </td>
                  <td class="max-w-64 truncate py-2 pr-3 text-xs text-slate-500">{{ row.question?.answer ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </template>
  </div>
</template>
