import type { Question } from '@/data/types'
import type { AnswerResult, EngineGraph, EngineSummary } from './diagEngine'

export type RemedyCardState =
  | 'locked'
  | 'practice'
  | 'help'
  | 'shortfall'
  | 'retest'
  | 'mastered'

export type RemedyPhase = 'practice' | 'retest'

export interface RemedyCard {
  topicId: string
  kind: 'weak' | 'shaky'
  isRoot: boolean
  isTarget: boolean
  order: number
  state: RemedyCardState
  unlocked: boolean
  practice: string[]
  retest: string[]
  cursor: number
  phase: RemedyPhase
  wrongs: number
  practiceShortfall: boolean
  retestShortfall: boolean
  masteredAt: number | null
  reviewStep: number
  reviewDueAt: number | null
}

export interface RemedyPlan {
  v: 1
  createdAt: number
  targets: string[]
  cards: RemedyCard[]
  usedIds: string[]
}

export interface RemedyItem {
  phase: RemedyPhase
  question: Question
  index: number
  total: number
}

export interface RemedyProgress {
  total: number
  mastered: number
  percent: number
}

export interface CreateRemedyPlanOptions {
  practiceSize?: number
  retestSize?: number
  seed?: number
  usedIds?: string[]
  now?: number
}

/** createPlan 只依赖 summary 的 targets 与 path，字段比 EngineSummary 少也允许 */
export type RemedySummaryInput = Pick<EngineSummary, 'targets' | 'path'>

export interface RemediationApi {
  REVIEW_INTERVALS_MS: number[]
  createPlan: (
    graph: EngineGraph,
    summary: RemedySummaryInput,
    options?: CreateRemedyPlanOptions,
  ) => RemedyPlan
  startPractice: (plan: RemedyPlan, topicId: string) => RemedyPlan
  nextItem: (graph: EngineGraph, plan: RemedyPlan, topicId: string) => RemedyItem | null
  applyAnswer: (
    graph: EngineGraph,
    plan: RemedyPlan,
    topicId: string,
    verdict: AnswerResult,
    now?: number,
  ) => RemedyPlan
  resumeAfterHelp: (plan: RemedyPlan, topicId: string) => RemedyPlan
  addVariant: (
    plan: RemedyPlan,
    topicId: string,
    phase: RemedyPhase,
    questions: Question[],
  ) => RemedyPlan
  reviewItems: (graph: EngineGraph, plan: RemedyPlan, topicId: string, count?: number) => Question[]
  dueReviews: (plan: RemedyPlan, now: number) => string[]
  applyReview: (
    plan: RemedyPlan,
    topicId: string,
    passed: boolean,
    now?: number,
  ) => RemedyPlan
  progress: (plan: RemedyPlan) => RemedyProgress
}

declare const remediation: RemediationApi
export default remediation
