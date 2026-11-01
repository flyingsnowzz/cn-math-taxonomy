// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDiagnoseStore } from '../diagnose'
import { useGraphDataStore } from '../graphData'
import type { DependencyEdge, GraphDataset, Question, Topic } from '@/data/types'

const topics: Topic[] = [
  { id: 'cnm_p1', name: '小学基础', domain: '数与代数', grade: 1, chapter: '一上 第1章', type: 'conceptual' },
  { id: 'cnm_j1', name: '初中目标', domain: '数与代数', grade: 7, chapter: '七上 第1章', type: 'procedural' },
]

const edges: DependencyEdge[] = [
  { topicId: 'cnm_j1', prerequisiteId: 'cnm_p1', strength: 'hard', reason: '需要基础' },
]

function question(topicId: string, index: number): Question {
  return {
    id: `${topicId}_q${index}`,
    topicId,
    type: 'choice',
    difficulty: index === 1 ? 'basic' : index === 2 ? 'standard' : 'challenge',
    prompt: `${topicId} ${index}`,
    answer: 'A',
    choices: [
      { key: 'A', text: '对' },
      { key: 'B', text: '错' },
    ],
  }
}

const questions = topics.flatMap((topic) => [1, 2, 3].map((index) => question(topic.id, index)))
const dataset: GraphDataset = {
  topics,
  edges,
  standards: { source: {}, items: [] },
  aliases: { aliases: {} },
}

describe('diagnose store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('/data/subjects/math-questions.json')) {
          return new Response(JSON.stringify({ subject: 'math', questions }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.includes('/data/subjects/math.json')) {
          return new Response(JSON.stringify(dataset), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('not found', { status: 404 })
      }),
    )
  })

  it('runs a demo without persisting it and produces a completed summary', async () => {
    await useGraphDataStore().load('math')
    const diagnose = useDiagnoseStore()
    await diagnose.load('math')
    diagnose.startDemo(['cnm_j1'], '演示')
    expect(diagnose.session?.answers.length).toBeGreaterThan(0)
    expect(diagnose.summary?.finished).toBe(true)
    expect(diagnose.summary?.weak).toContain('cnm_j1')
    expect(localStorage.getItem('cnmDiagnose.session.v2')).toBeNull()
  })
})
