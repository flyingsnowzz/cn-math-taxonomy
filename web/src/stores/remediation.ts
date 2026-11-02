import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { readJson, remove, writeJson } from '@/utils/storage'
import { useBlindspotsStore } from './blindspots'
import type { SubjectCode, Topic } from '@/data/types'
import type { AnswerResult, EngineGraph, EngineSummary } from '@/engine/engineAdapter'
import {
  applyRemedyAnswer,
  applyReview,
  createPlan,
  dueReviews,
  nextRemedyItem,
  remedyProgress,
  resumeAfterHelp,
  reviewItems,
  type RemedyCard,
  type RemedyItem,
  type RemedyPlan,
  type RemedyProgress,
  type RemedySummaryInput,
} from '@/engine/remediationAdapter'

interface RemedyFile {
  v: 1
  subject: SubjectCode
  plan: RemedyPlan
  savedAt: string
}

function storageKey(subject: SubjectCode): string {
  return `cnmRemedy.plan.${subject}.v1`
}

function isRemedyFile(value: unknown): value is RemedyFile {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.v !== 1 || typeof record.subject !== 'string') return false
  if (typeof record.plan !== 'object' || record.plan === null) return false
  const plan = record.plan as Record<string, unknown>
  return Array.isArray(plan.cards) && Array.isArray(plan.usedIds) && Array.isArray(plan.targets)
}

export interface DueReview {
  subject: SubjectCode
  topicId: string
  dueAt: number
}

const SUBJECT_CODES: SubjectCode[] = [
  'math', 'english', 'physics', 'chinese', 'science', 'morality', 'history', 'geography',
]

/** 不依赖图谱，直接从各学科本地计划读取到期复习（首页用）。 */
export function readDueReviewsAll(now: number = Date.now()): DueReview[] {
  const result: DueReview[] = []
  for (const code of SUBJECT_CODES) {
    const file = readJson<RemedyFile>(storageKey(code), isRemedyFile)
    if (!file || file.subject !== code) continue
    for (const card of file.plan.cards) {
      if (card.state === 'mastered' && card.reviewDueAt !== null && card.reviewDueAt <= now) {
        result.push({ subject: code, topicId: card.topicId, dueAt: card.reviewDueAt })
      }
    }
  }
  return result
}

// 诊断会话的 seed 是字符串，remediation 需要 32 位整数种子（FNV-1a）。
export function hashSeed(input: string | undefined | null): number {
  if (!input) return 1
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export interface RemedyCardView {
  card: RemedyCard
  topic: Topic | null
}

export const useRemediationStore = defineStore('remediation', () => {
  // 图数据只用于查询，不放进响应式状态（体积大且不可变）。
  let graph: EngineGraph | null = null
  const subject = ref<SubjectCode>('math')
  const plan = ref<RemedyPlan | null>(null)
  const currentTopicId = ref<string | null>(null)
  const savedAt = ref('')
  const lastError = ref('')

  function firstOpenCardId(next: RemedyPlan | null): string | null {
    if (!next) return null
    const open = next.cards.find((card) => card.state !== 'mastered' && card.unlocked)
    return open?.topicId ?? null
  }

  function persist(): boolean {
    if (!plan.value) return false
    const file: RemedyFile = {
      v: 1,
      subject: subject.value,
      plan: plan.value,
      savedAt: new Date().toISOString(),
    }
    const ok = writeJson(storageKey(subject.value), file)
    if (ok) savedAt.value = file.savedAt
    else lastError.value = '本地存储不可用，进度无法保存'
    return ok
  }

  function attachGraph(nextGraph: EngineGraph, nextSubject: SubjectCode): void {
    graph = nextGraph
    subject.value = nextSubject
    const file = readJson<RemedyFile>(storageKey(nextSubject), isRemedyFile)
    if (file && file.subject === nextSubject) {
      plan.value = file.plan
      savedAt.value = file.savedAt
    } else {
      plan.value = null
      savedAt.value = ''
    }
    currentTopicId.value = firstOpenCardId(plan.value)
    lastError.value = ''
  }

  function startFromSummary(
    nextGraph: EngineGraph,
    summary: RemedySummaryInput,
    usedQuestionIds: string[],
    nextSubject: SubjectCode,
    sessionSeed?: string,
  ): RemedyPlan {
    graph = nextGraph
    subject.value = nextSubject
    const next = createPlan(nextGraph, summary, {
      usedIds: usedQuestionIds,
      seed: hashSeed(sessionSeed),
    })
    plan.value = next
    currentTopicId.value = firstOpenCardId(next)
    lastError.value = ''
    persist()
    return next
  }

  function selectCard(topicId: string): void {
    const card = plan.value?.cards.find((item) => item.topicId === topicId)
    if (card && card.unlocked) currentTopicId.value = topicId
  }

  function answerCurrent(verdict: AnswerResult): void {
    if (!graph || !plan.value || !currentTopicId.value) return
    const topicId = currentTopicId.value
    const before = plan.value.cards.find((card) => card.topicId === topicId)
    const next = applyRemedyAnswer(graph, plan.value, topicId, verdict)
    plan.value = next
    persist()

    const after = next.cards.find((card) => card.topicId === topicId)
    if (before?.state !== 'mastered' && after?.state === 'mastered') {
      noteMastered(topicId)
      if (currentTopicId.value === topicId) currentTopicId.value = firstOpenCardId(next)
    }
  }

  function resumeHelp(): void {
    if (!plan.value || !currentTopicId.value) return
    plan.value = resumeAfterHelp(plan.value, currentTopicId.value)
    persist()
  }

  // 复测通过 → 写入既有盲区台账（status=mastered 后自动从盲区列表消失）。
  function noteMastered(topicId: string): void {
    const blindspots = useBlindspotsStore()
    const masteredSummary: EngineSummary = {
      mode: 'target',
      targets: plan.value?.targets ?? [],
      asked: 0,
      limit: 0,
      finished: true,
      limitReached: false,
      mastered: [topicId],
      shaky: [],
      weak: [],
      unconfirmed: [],
      untested: [],
      roots: [],
      path: [{ id: topicId, status: 'mastered' }],
    }
    blindspots.noteResult({
      subject: subject.value,
      label: '补救复测通过',
      key: `remedy:${topicId}`,
      answers: [],
      summary: masteredSummary,
    })
  }

  function reviewQuestionFor(topicId: string): RemedyItem['question'] | null {
    if (!graph || !plan.value) return null
    return reviewItems(graph, plan.value, topicId, 1)[0] ?? null
  }

  function answerReview(topicId: string, passed: boolean): void {
    if (!graph || !plan.value) return
    plan.value = applyReview(plan.value, topicId, passed)
    persist()
  }

  function reset(): void {
    remove(storageKey(subject.value))
    plan.value = null
    currentTopicId.value = null
    savedAt.value = ''
    lastError.value = ''
  }

  const cards = computed<RemedyCardView[]>(() =>
    (plan.value?.cards ?? []).map((card) => ({
      card,
      topic: graph?.byId[card.topicId] ?? null,
    })),
  )

  const currentCard = computed<RemedyCard | null>(
    () => plan.value?.cards.find((card) => card.topicId === currentTopicId.value) ?? null,
  )

  const currentItem = computed<RemedyItem | null>(() => {
    // 注意：响应式依赖必须无条件先读取。早期求值（如组件 setup 里的 watch 源）
    // 发生在 graph/plan 就绪之前；若用短路守卫提前 return，computed 会追踪不到
    // plan/currentTopicId，之后状态就绪也永远返回缓存的 null。
    const currentPlan = plan.value
    const tid = currentTopicId.value
    if (!graph || !currentPlan || !tid) return null
    return nextRemedyItem(graph, currentPlan, tid)
  })

  const progress = computed<RemedyProgress | null>(() => (plan.value ? remedyProgress(plan.value) : null))

  const dueReviewIds = computed<string[]>(() => (plan.value ? dueReviews(plan.value, Date.now()) : []))

  return {
    subject,
    plan,
    currentTopicId,
    savedAt,
    lastError,
    attachGraph,
    startFromSummary,
    selectCard,
    answerCurrent,
    resumeHelp,
    reviewQuestionFor,
    answerReview,
    reset,
    cards,
    currentCard,
    currentItem,
    progress,
    dueReviewIds,
  }
})
