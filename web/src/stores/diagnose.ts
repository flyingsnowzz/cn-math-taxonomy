import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { loadSubjectQuestions } from '@/data/dataClient'
import { useGraphDataStore } from './graphData'
import { buildChapterTree, type ChapterTree } from '@/data/chapterTree'
import { readJson, remove, writeJson } from '@/utils/storage'
import type {
  DependencyEdge,
  IdAliasesFile,
  Question,
  SubjectCode,
  Topic,
} from '@/data/types'
import {
  applyAnswer,
  buildGraph,
  createSession,
  gradeTargets,
  judgeAnswer,
  nextItem,
  replay,
  resolveTargets,
  summarize,
  type AnswerResult,
  type EngineGraph,
  type EngineNextItem,
  type EngineSession,
  type EngineSummary,
} from '@/engine/engineAdapter'

export interface DiagnosticSavedSession {
  v: 2
  mode: 'target' | 'screen'
  targets: string[]
  limit: number
  confirm: number
  label: string
  answers: EngineSession['answers']
  seed: string
  avoid: string[]
  savedAt: string
}

export interface DiagnosticOptions {
  mode?: 'target' | 'screen'
  limit?: number
  confirm?: number
  seed?: string
  avoid?: string[]
}

export interface DiagnosticVerdict {
  result: AnswerResult
  reason: string
  manual: boolean
}

function isSavedSession(value: unknown): value is DiagnosticSavedSession {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.v === 2 &&
    (record.mode === 'target' || record.mode === 'screen') &&
    Array.isArray(record.targets) &&
    record.targets.every((target) => typeof target === 'string') &&
    typeof record.limit === 'number' &&
    typeof record.confirm === 'number' &&
    Array.isArray(record.answers) &&
    typeof record.seed === 'string' &&
    Array.isArray(record.avoid)
  )
}

export const useDiagnoseStore = defineStore('diagnose', () => {
  const graphData = useGraphDataStore()
  const graph = ref<EngineGraph | null>(null)
  const edges = ref<DependencyEdge[]>([])
  const session = ref<EngineSession | null>(null)
  const label = ref('')
  const savedAt = ref('')
  const aliases = ref<IdAliasesFile | null>(null)
  const chapterTree = ref<ChapterTree>({ volumes: [], chaptersByKey: new Map() })
  const subject = ref<SubjectCode>('math')
  const loadError = ref('')

  const currentItem = computed<EngineNextItem | null>(() => {
    if (!graph.value || !session.value) return null
    return nextItem(graph.value, session.value)
  })
  const summary = computed<EngineSummary | null>(() => {
    if (!graph.value || !session.value || currentItem.value) return null
    return summarize(graph.value, session.value)
  })
  const topicById = computed<Map<string, Topic>>(() => new Map(graph.value?.topics.map((topic) => [topic.id, topic])))
  const questionById = computed<Map<string, Question>>(() => {
    const map = new Map<string, Question>()
    for (const question of graph.value?.bank ? Object.values(graph.value.bank).flat() : []) {
      map.set(question.id, question)
    }
    return map
  })

  function storageKey(): string {
    const keys: Record<SubjectCode, string> = {
      math: 'cnmDiagnose.session.v2',
      english: 'cneDiagnose.session.v2',
      physics: 'cnpDiagnose.session.v2',
      chinese: 'cncDiagnose.session.v2',
      science: 'cnsDiagnose.session.v1',
      morality: 'cndDiagnose.session.v1',
      history: 'cnhDiagnose.session.v1',
      geography: 'cngDiagnose.session.v1',
    }
    return keys[subject.value]
  }

  function persist() {
    if (!session.value) return
    const saved: DiagnosticSavedSession = {
      v: 2,
      mode: session.value.mode,
      targets: session.value.targets,
      limit: session.value.limit,
      confirm: session.value.confirm,
      label: label.value,
      answers: session.value.answers,
      seed: session.value.seed,
      avoid: session.value.avoid,
      savedAt: new Date().toISOString(),
    }
    savedAt.value = saved.savedAt
    writeJson(storageKey(), saved)
  }

  async function load(nextSubject: SubjectCode) {
    subject.value = nextSubject
    loadError.value = ''
    try {
      await graphData.load(nextSubject)
      const dataset = graphData.dataset
      if (!dataset) throw new Error('图谱数据未加载')
      const { questions } = await loadSubjectQuestions(nextSubject)
      const allowed = new Set(graphData.topicsFor(nextSubject).map((topic) => topic.id))
      const topics: Topic[] = graphData.topicsFor(nextSubject)
      const subjectEdges = dataset.edges.filter(
        (edge) => allowed.has(edge.topicId) && allowed.has(edge.prerequisiteId),
      )
      edges.value = subjectEdges
      chapterTree.value = buildChapterTree(topics)
      graph.value = buildGraph(topics, subjectEdges, questions)
      aliases.value = dataset.aliases
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : '诊断数据加载失败'
    }
  }

  function resolveTargetIds(rawTargets: string[]): string[] {
    return aliases.value ? resolveTargets(rawTargets, aliases.value) : rawTargets
  }

  function start(rawTargets: string[], nextLabel?: string, options: DiagnosticOptions = {}) {
    if (!graph.value) return
    const targets = resolveTargetIds(rawTargets).filter((id) => Boolean(graph.value?.byId[id]))
    if (targets.length === 0) throw new Error('请选择至少一个有效知识点')
    const sessionOptions = {
      mode: options.mode ?? 'target',
      limit: options.limit,
      confirm: options.confirm,
      seed: options.seed ?? `web-${Math.random().toString(36).slice(2, 10)}`,
      avoid: options.avoid ?? [],
    }
    session.value = createSession(graph.value, targets, sessionOptions)
    label.value = nextLabel || targets.map((id) => graph.value?.byId[id]?.name ?? id).join('、')
    savedAt.value = ''
    persist()
  }

  function startDemo(rawTargets: string[], nextLabel?: string) {
    if (!graph.value) return
    start(rawTargets, nextLabel, {
      mode: 'target',
      limit: 120,
      confirm: 3,
      seed: 'demo',
      avoid: [],
    })
    let active = session.value
    if (!active) return

    let weakNonTargets = 0
    let shakyNonTargets = 0
    let guard = 0
    let next = nextItem(graph.value, active)
    while (next && guard < 300) {
      guard += 1
      const item = next
      const isTarget = active.targets.includes(item.topicId)
      let result: AnswerResult
      if (isTarget) {
        result = 'wrong'
      } else if (weakNonTargets === 0) {
        weakNonTargets += 1
        result = 'wrong'
      } else if (shakyNonTargets === 0) {
        shakyNonTargets += 1
        result = 'wrong'
      } else {
        result = 'correct'
      }

      active = applyAnswer(graph.value, active, item.topicId, result)
      if (
        !isTarget &&
        weakNonTargets === 1 &&
        shakyNonTargets === 1 &&
        result === 'wrong'
      ) {
        const followup = nextItem(graph.value, active)
        if (followup && followup.topicId === item.topicId) {
          active = applyAnswer(graph.value, active, followup.topicId, 'correct')
        }
      }
      next = nextItem(graph.value, active)
    }
    session.value = active
    remove(storageKey())
  }

  function startChapter(chapterKey: string): string | null {
    const chapter = chapterTree.value.chaptersByKey.get(chapterKey)
    if (!chapter) return null
    start(
      chapter.topics.map((item) => item.topic.id),
      `${chapter.fullLabel}（整章）`,
    )
    return chapter.fullLabel
  }

  function startGradeScope(scope: string): string | null {
    if (!graph.value) return null
    const result = gradeTargets(graph.value, scope, subject.value)
    if (!result) return null
    start(result.ids, `${result.label}整体诊断`, { mode: 'screen' })
    return result.label
  }

  function restore(saved: DiagnosticSavedSession): boolean {
    if (!graph.value) return false
    try {
      session.value = buildReplay(saved)
      label.value = saved.label || saved.targets.map((id) => graph.value?.byId[id]?.name ?? id).join('、')
      savedAt.value = saved.savedAt
      return true
    } catch {
      clearSavedSession()
      return false
    }
  }

  function buildReplay(saved: DiagnosticSavedSession): EngineSession {
    if (!graph.value) throw new Error('图未初始化')
    return replay(
      graph.value,
      saved.targets,
      saved.answers,
      {
        mode: saved.mode,
        limit: saved.limit,
        confirm: saved.confirm,
        seed: saved.seed,
        avoid: saved.avoid,
      },
    )
  }

  function readSavedSession(): DiagnosticSavedSession | null {
    return readJson(storageKey(), isSavedSession)
  }

  function clearSavedSession() {
    session.value = null
    label.value = ''
    savedAt.value = ''
    remove(storageKey())
  }

  function restart() {
    clearSavedSession()
  }

  function submit(result: AnswerResult, userText?: string) {
    if (!graph.value || !session.value || !currentItem.value) return
    session.value = applyAnswer(
      graph.value,
      session.value,
      currentItem.value.topicId,
      result,
      userText,
    )
    persist()
  }

  function judge(question: Question, answer: string): DiagnosticVerdict {
    const verdict = judgeAnswer(question, answer)
    if (verdict.verdict === 'manual') {
      return { result: 'wrong', reason: verdict.reason, manual: true }
    }
    return { result: verdict.verdict, reason: verdict.reason, manual: false }
  }

  function undo() {
    if (!graph.value || !session.value) return
    const answers = session.value.answers.slice(0, -1)
    session.value = buildReplay({
      v: 2,
      mode: session.value.mode,
      targets: session.value.targets,
      limit: session.value.limit,
      confirm: session.value.confirm,
      label: label.value,
      answers,
      seed: session.value.seed,
      avoid: session.value.avoid,
      savedAt: savedAt.value,
    })
    persist()
  }

  function nameOf(id: string): string {
    return topicById.value.get(id)?.name ?? id
  }

  return {
    graph,
    edges,
    chapterTree,
    session,
    label,
    savedAt,
    subject,
    loadError,
    currentItem,
    summary,
    topicById,
    questionById,
    load,
    start,
    startDemo,
    startChapter,
    startGradeScope,
    resolveTargetIds,
    restore,
    readSavedSession,
    clearSavedSession,
    restart,
    submit,
    judge,
    undo,
    nameOf,
  }
})
