import { describe, expect, it } from 'vitest'
import { applyAnswer, buildGraph, createSession, nextItem, summarize } from '../engineAdapter'
import type { DependencyEdge, Question, Topic } from '@/data/types'

const topics: Topic[] = [
  { id: 'cnm_p1', name: '基础', domain: '数与代数', grade: 1, chapter: '一上', type: 'conceptual' },
  { id: 'cnm_j1', name: '目标', domain: '数与代数', grade: 7, chapter: '七上', type: 'procedural' },
]

const edges: DependencyEdge[] = [
  { topicId: 'cnm_j1', prerequisiteId: 'cnm_p1', strength: 'hard', reason: 'test' },
]

const questions: Question[] = [
  ...(['basic', 'standard', 'challenge'] as const).map((difficulty, index) => ({
    id: `cnm_p1_q${index + 1}`,
    topicId: 'cnm_p1',
    type: 'choice' as const,
    difficulty,
    prompt: `p1 ${index}`,
    answer: 'A',
    choices: [
      { key: 'A', text: '对' },
      { key: 'B', text: '错' },
    ],
  })),
  ...(['basic', 'standard', 'challenge'] as const).map((difficulty, index) => ({
    id: `cnm_j1_q${index + 1}`,
    topicId: 'cnm_j1',
    type: 'choice' as const,
    difficulty,
    prompt: `j1 ${index}`,
    answer: 'A',
    choices: [
      { key: 'A', text: '对' },
      { key: 'B', text: '错' },
    ],
  })),
]

describe('engineAdapter', () => {
  it('preserves the legacy backtracking behavior', () => {
    const graph = buildGraph(topics, edges, questions)
    let session = createSession(graph, ['cnm_j1'], { confirm: 2, limit: 8, seed: 'test' })
    expect(nextItem(graph, session)?.topicId).toBe('cnm_j1')

    session = applyAnswer(graph, session, 'cnm_j1', 'wrong')
    session = applyAnswer(graph, session, 'cnm_j1', 'wrong')
    expect(nextItem(graph, session)?.topicId).toBe('cnm_p1')

    const result = summarize(graph, session)
    expect(result.weak).toContain('cnm_j1')
    expect(result.roots[0]?.pendingPrereqs).toContain('cnm_p1')
  })
})
