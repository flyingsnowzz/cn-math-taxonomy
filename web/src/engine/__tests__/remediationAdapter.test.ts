import { describe, expect, it } from 'vitest'
import {
  applyRemedyAnswer,
  applyReview,
  createPlan,
  dueReviews,
  nextRemedyItem,
  remedyProgress,
  resumeAfterHelp,
} from '../remediationAdapter'
import { buildGraph } from '../engineAdapter'
import type { DependencyEdge, Question, Topic } from '@/data/types'
import type { EngineGraph } from '../legacy/diagEngine'
import type { RemedySummaryInput } from '../legacy/remediation'

const DAY = 24 * 60 * 60 * 1000

function makeQuestion(topicId: string, n: number, difficulty: Question['difficulty']): Question {
  return {
    id: `${topicId}_q${n}`,
    topicId,
    difficulty,
    type: 'numeric',
    prompt: `${topicId} ${n}`,
    answer: '1',
    verify: '1',
  }
}

function makeTopic(id: string, grade: number): Topic {
  return {
    id,
    name: id,
    domain: '数与代数',
    grade,
    chapter: '测试章',
    type: 'procedural',
  }
}

function fixture(): { graph: EngineGraph; summary: RemedySummaryInput } {
  const topics = [makeTopic('a', 7), makeTopic('b', 8)]
  const edges: DependencyEdge[] = [
    { topicId: 'b', prerequisiteId: 'a', strength: 'hard', reason: 'r' },
  ]
  const questions: Question[] = [1, 2, 3, 4, 5].flatMap((n) => [
    makeQuestion('a', n, n <= 2 ? 'basic' : 'standard'),
    makeQuestion('b', n, n <= 2 ? 'basic' : 'standard'),
  ])
  const graph = buildGraph(topics, edges, questions)
  const summary: RemedySummaryInput = {
    targets: ['b'],
    path: [
      { id: 'a', status: 'weak', isRoot: true },
      { id: 'b', status: 'weak', isTarget: true },
    ],
  }
  return { graph, summary }
}

describe('remediationAdapter（vendored ESM 副本）', () => {
  it('练习全对 → 复测通过 → 解锁下一张卡并安排复习', () => {
    const { graph, summary } = fixture()
    const t0 = Date.parse('2026-11-02T00:00:00+08:00')
    let plan = createPlan(graph, summary, { seed: 1 })

    // 第一张卡：练习 3 题
    for (let i = 0; i < 3; i++) {
      expect(nextRemedyItem(graph, plan, 'a')?.phase).toBe('practice')
      plan = applyRemedyAnswer(graph, plan, 'a', 'correct', t0)
    }
    // 复测 2 题
    for (let i = 0; i < 2; i++) {
      expect(nextRemedyItem(graph, plan, 'a')?.phase).toBe('retest')
      plan = applyRemedyAnswer(graph, plan, 'a', 'correct', t0)
    }

    const first = plan.cards.find((item) => item.topicId === 'a')
    const second = plan.cards.find((item) => item.topicId === 'b')
    expect(first?.state).toBe('mastered')
    expect(second?.state).toBe('practice')
    expect(first?.reviewDueAt).toBe(t0 + DAY)
    expect(dueReviews(plan, t0 + DAY)).toEqual(['a'])
    expect(remedyProgress(plan)).toEqual({ total: 2, mastered: 1, percent: 50 })
  })

  it('练习答错进入 help，resume 后继续；复习失败打回练习', () => {
    const { graph, summary } = fixture()
    let plan = createPlan(graph, summary, { seed: 1 })
    plan = applyRemedyAnswer(graph, plan, 'a', 'wrong')
    const firstCard = plan.cards.find((item) => item.topicId === 'a')
    expect(firstCard?.state).toBe('help')
    plan = resumeAfterHelp(plan, 'a')
    const resumedCard = plan.cards.find((item) => item.topicId === 'a')
    expect(resumedCard?.state).toBe('practice')

    const card = resumedCard!
    card.state = 'mastered'
    card.reviewStep = 0
    card.reviewDueAt = 1000
    plan = applyReview(plan, 'a', false, 2000)
    expect(plan.cards.find((item) => item.topicId === 'a')?.state).toBe('practice')
    expect(plan.cards.find((item) => item.topicId === 'a')?.reviewDueAt).toBeNull()
  })
})
