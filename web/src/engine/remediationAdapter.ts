import remediation from './legacy/remediation.js'
import type { Question } from '@/data/types'
import type { AnswerResult, EngineGraph } from './legacy/diagEngine.js'
import type {
  CreateRemedyPlanOptions,
  RemedyItem,
  RemedyPhase,
  RemedyPlan,
  RemedyProgress,
  RemedySummaryInput,
} from './legacy/remediation.js'

export type {
  CreateRemedyPlanOptions,
  RemedyCard,
  RemedyCardState,
  RemedyItem,
  RemedyPhase,
  RemedyPlan,
  RemedyProgress,
  RemedySummaryInput,
} from './legacy/remediation.js'

export function createPlan(
  graph: EngineGraph,
  summary: RemedySummaryInput,
  options?: CreateRemedyPlanOptions,
): RemedyPlan {
  return remediation.createPlan(graph, summary, options)
}

export function startPractice(plan: RemedyPlan, topicId: string): RemedyPlan {
  return remediation.startPractice(plan, topicId)
}

export function nextRemedyItem(
  graph: EngineGraph,
  plan: RemedyPlan,
  topicId: string,
): RemedyItem | null {
  return remediation.nextItem(graph, plan, topicId)
}

export function applyRemedyAnswer(
  graph: EngineGraph,
  plan: RemedyPlan,
  topicId: string,
  verdict: AnswerResult,
  now?: number,
): RemedyPlan {
  return remediation.applyAnswer(graph, plan, topicId, verdict, now)
}

export function resumeAfterHelp(plan: RemedyPlan, topicId: string): RemedyPlan {
  return remediation.resumeAfterHelp(plan, topicId)
}

export function addVariant(
  plan: RemedyPlan,
  topicId: string,
  phase: RemedyPhase,
  questions: Question[],
): RemedyPlan {
  return remediation.addVariant(plan, topicId, phase, questions)
}

export function reviewItems(
  graph: EngineGraph,
  plan: RemedyPlan,
  topicId: string,
  count?: number,
): Question[] {
  return remediation.reviewItems(graph, plan, topicId, count)
}

export function dueReviews(plan: RemedyPlan, now: number): string[] {
  return remediation.dueReviews(plan, now)
}

export function applyReview(
  plan: RemedyPlan,
  topicId: string,
  passed: boolean,
  now?: number,
): RemedyPlan {
  return remediation.applyReview(plan, topicId, passed, now)
}

export function remedyProgress(plan: RemedyPlan): RemedyProgress {
  return remediation.progress(plan)
}
