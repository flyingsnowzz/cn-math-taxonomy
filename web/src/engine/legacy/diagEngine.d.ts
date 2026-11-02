import type {
  DependencyEdge,
  Question,
  SubjectCode,
  Topic,
} from '@/data/types'

export type AnswerResult = 'correct' | 'wrong' | 'skip'

export interface EngineAttempt {
  id: string
  qid: string | null
  result: AnswerResult
  text?: string
}

export interface EngineSession {
  targets: string[]
  limit: number
  confirm: number
  order: string[]
  status: Record<string, { s: 'mastered' | 'shaky' | 'weak'; src: 'direct' | 'inferred' }>
  stack: string[]
  answers: EngineAttempt[]
  attempts: Record<string, EngineAttempt[]>
  mode: 'target' | 'screen'
  scope: string[] | null
  seed: string
  avoid: string[]
}

export interface EngineNextItem {
  topicId: string
  question: Question
  attempt: number
}

export interface EngineLayoutNode extends EnginePathNode {
  layer: number
  col: number
  cols: number
}

export interface EngineLayoutEdge {
  from: string
  to: string
  direct: boolean
  strength: string
}

export interface EngineLayout {
  nodes: EngineLayoutNode[]
  edges: EngineLayoutEdge[]
  layers: number
  maxCols: number
}

export interface EnginePathNode {
  id: string
  status: 'mastered' | 'shaky' | 'weak' | 'unknown'
  isRoot?: boolean
  isTarget?: boolean
}
export interface EngineChapterSummary {
  key: string
  volume: string
  chapterNo: string
  chapterName: string
  label: string
  topics: unknown[]
  total: number
  mastered: number
  shaky: number
  weak: number
  untested: number
  weakIds: string[]
  shakyIds: string[]
  untestedIds: string[]
}

export interface EngineSummary {
  mode: 'target' | 'screen'
  targets: string[]
  asked: number
  limit: number
  finished: boolean
  limitReached: boolean
  mastered: string[]
  shaky: string[]
  weak: string[]
  unconfirmed: string[]
  untested: string[]
  roots: Array<{
    id: string
    pendingPrereqs: string[]
    outOfScopePrereqs: string[]
    externalPrereqs: string[]
  }>
  path: EnginePathNode[]
}

export interface EngineGraph {
  topics: Topic[]
  byId: Record<string, Topic>
  index: Record<string, number>
  prereqs: Record<string, Array<{ id: string; strength: string; reason?: string }>>
  dependents: Record<string, Array<{ id: string; strength: string }>>
  bank: Record<string, Question[]>
  hasBank: boolean
}

export interface Verdict {
  verdict: 'correct' | 'wrong' | 'manual'
  reason: string
}

export interface DiagEngineApi {
  DEFAULT_LIMIT: number
  SCREEN_LIMIT: number
  DEFAULT_CONFIRM: number
  CONFIRM_CHOICES: number[]
  buildGraph: (topics: Topic[], edges: DependencyEdge[], questions?: Question[]) => EngineGraph
  createSession: (
    graph: EngineGraph,
    targets: string[],
    options?: Record<string, unknown>,
  ) => EngineSession
  nextItem: (graph: EngineGraph, session: EngineSession) => EngineNextItem | null
  applyAnswer: (
    graph: EngineGraph,
    session: EngineSession,
    topicId: string,
    result: AnswerResult,
    extra?: { text?: string },
  ) => EngineSession
  replay: (
    graph: EngineGraph,
    targets: string[],
    answers: EngineAttempt[],
    options?: Record<string, unknown>,
  ) => EngineSession
  summarize: (graph: EngineGraph, session: EngineSession) => EngineSummary
  layout: (graph: EngineGraph, session: EngineSession, summary: EngineSummary) => EngineLayout
  chapterSummary: (graph: EngineGraph, session: EngineSession) => EngineChapterSummary[]
  statusOf: (session: EngineSession, topicId: string) => string
  subjectOf: (topic: Topic) => SubjectCode
  gradeTargets: (
    graph: EngineGraph,
    scope: string,
    subject?: string,
  ) => { ids: string[]; volumes: string[]; label: string } | null
  parseChapter: (chapter: string) => {
    volume: string
    chapterNo: string
    chapterName: string
    section: string
  }
  resolveTargets: (rawIds: string[], aliases: unknown) => string[]
  judgeQuestion: (question: Question, userAnswer: string) => Verdict
}

declare const engine: DiagEngineApi
export default engine
