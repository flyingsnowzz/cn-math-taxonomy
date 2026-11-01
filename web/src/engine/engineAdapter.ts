import type { AliasTargetList, DependencyEdge, IdAliasesFile, Question, Topic } from '@/data/types'
import engine, {
  type AnswerResult,
  type EngineGraph,
  type EngineNextItem,
  type EngineSession,
  type EngineChapterSummary,
  type EngineSummary,
} from './legacy/diagEngine.js'

export type {
  AnswerResult,
  EngineGraph,
  EngineNextItem,
  EngineSession,
  EngineChapterSummary,
  EngineSummary,
} from './legacy/diagEngine.js'

function aliasTargets(spec: AliasTargetList | undefined): string[] {
  if (!spec) return []
  return Array.isArray(spec) ? spec : (spec.targets ?? [])
}

export function buildGraph(
  topics: Topic[],
  edges: DependencyEdge[],
  questions: Question[] = [],
): EngineGraph {
  return engine.buildGraph(topics, edges, questions)
}

export function createSession(
  graph: EngineGraph,
  targets: string[],
  options?: Record<string, unknown>,
): EngineSession {
  return engine.createSession(graph, targets, options)
}

export function nextItem(graph: EngineGraph, session: EngineSession): EngineNextItem | null {
  return engine.nextItem(graph, session)
}

export function applyAnswer(
  graph: EngineGraph,
  session: EngineSession,
  topicId: string,
  result: AnswerResult,
  userAnswer?: string,
): EngineSession {
  return engine.applyAnswer(
    graph,
    session,
    topicId,
    result,
    userAnswer === undefined ? undefined : { text: userAnswer },
  )
}

export function summarize(graph: EngineGraph, session: EngineSession): EngineSummary {
  return engine.summarize(graph, session)
}

export function chapterSummary(graph: EngineGraph, session: EngineSession): EngineChapterSummary[] {
  return engine.chapterSummary(graph, session)
}

export function replay(
  graph: EngineGraph,
  targets: string[],
  answers: EngineSession['answers'],
  options?: Record<string, unknown>,
): EngineSession {
  return engine.replay(graph, targets, answers, options)
}

export function resolveTargets(rawIds: string[], aliases: IdAliasesFile): string[] {
  const aliasMap: Record<string, AliasTargetList> = aliases.aliases
  return engine.resolveTargets(rawIds, aliasMap)
}

export function resolveAllTargets(spec: AliasTargetList | undefined): string[] {
  return aliasTargets(spec)
}



export interface ParsedChapter {
  volume: string
  chapterNo: string
  chapterName: string
  section: string
}

export function parseChapter(chapter: string): ParsedChapter {
  const parsed = engine.parseChapter(chapter) as ParsedChapter
  return parsed
}

export function gradeTargets(
  graph: EngineGraph,
  scope: string,
  subject: string,
): { ids: string[]; volumes: string[]; label: string } | null {
  return engine.gradeTargets(graph, scope, subject)
}

export function judgeAnswer(question: Question, answer: string) {
  return engine.judgeQuestion(question, answer)
}
