// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readDueReviewsAll, useRemediationStore } from '../remediation'
import { useBlindspotsStore } from '../blindspots'
import { buildGraph } from '@/engine/engineAdapter'
import type { DependencyEdge, Question, SubjectCode, Topic } from '@/data/types'
import type { EngineGraph } from '@/engine/legacy/diagEngine'
import type { RemedySummaryInput } from '@/engine/remediationAdapter'
import { readJson } from '@/utils/storage'

const SUBJECT: SubjectCode = 'math'

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

function fixture(): { graph: EngineGraph; summary: RemedySummaryInput } {
  const topics: Topic[] = [
    { id: 'a', name: '根因点', domain: '数与代数', grade: 7, chapter: '七上 第一章', type: 'procedural' },
    { id: 'b', name: '目标点', domain: '数与代数', grade: 8, chapter: '八上 第二章', type: 'procedural' },
  ]
  const edges: DependencyEdge[] = [
    { topicId: 'b', prerequisiteId: 'a', strength: 'hard', reason: 'r' },
  ]
  const questions: Question[] = [1, 2, 3, 4, 5, 6, 7].flatMap((n) => [
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

// 把第一张卡完整走完（练习全对 + 复测全对）
function masterFirstCard(store: ReturnType<typeof useRemediationStore>) {
  // 练习 3 题
  for (let i = 0; i < 3; i++) {
    expect(store.currentItem?.phase).toBe('practice')
    store.answerCurrent('correct')
  }
  // 复测 2 题
  for (let i = 0; i < 2; i++) {
    expect(store.currentItem?.phase).toBe('retest')
    store.answerCurrent('correct')
  }
}

describe('remediation store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('从 summary 建卡：第一张解锁、第二张锁定，并带知识点名称', () => {
    const store = useRemediationStore()
    const { graph, summary } = fixture()
    store.startFromSummary(graph, summary, [], SUBJECT, 'seed-xyz')

    expect(store.plan?.cards).toHaveLength(2)
    expect(store.cards[0]?.topic?.name).toBe('根因点')
    expect(store.cards[0]?.card.state).toBe('practice')
    expect(store.cards[1]?.card.state).toBe('locked')
    expect(store.currentTopicId).toBe('a')
  })

  it('相同 summary + 诊断 seed 生成确定性的计划（已做题被排除）', () => {
    const store1 = useRemediationStore()
    const { graph, summary } = fixture()
    const p1 = store1.startFromSummary(graph, summary, [], SUBJECT, 'seed-xyz', 1000)
    const pinia2 = createPinia()
    setActivePinia(pinia2)
    const store2 = useRemediationStore()
    const p2 = store2.startFromSummary(graph, summary, [], SUBJECT, 'seed-xyz', 1000)
    expect(JSON.stringify(p2)).toBe(JSON.stringify(p1))

    const used = ['a_q1', 'b_q1']
    const p3 = store2.startFromSummary(graph, summary, used, SUBJECT, 'seed-xyz', 1000)
    const firstPlanCard = p3.cards[0]!
    const ids = firstPlanCard.practice.concat(firstPlanCard.retest)
    expect(ids.some((id) => used.includes(id))).toBe(false)
  })

  it('进度持久化：attachGraph 重新加载同一计划，坏数据回退为空', () => {
    const store = useRemediationStore()
    const { graph, summary } = fixture()
    store.startFromSummary(graph, summary, [], SUBJECT, 's')
    store.answerCurrent('wrong')
    expect(store.currentCard?.state).toBe('help')

    const reloaded = useRemediationStore()
    reloaded.attachGraph(graph, SUBJECT)
    expect(reloaded.plan?.cards[0]?.state).toBe('help')

    localStorage.setItem('cnmRemedy.plan.math.v1', '{not json')
    const fresh = useRemediationStore()
    fresh.attachGraph(graph, SUBJECT)
    expect(fresh.plan).toBeNull()
  })

  it('答错挂起 help，resumeHelp 后继续答题', () => {
    const store = useRemediationStore()
    const { graph, summary } = fixture()
    store.startFromSummary(graph, summary, [], SUBJECT, 's')
    store.answerCurrent('wrong')
    expect(store.currentCard?.state).toBe('help')
    expect(store.currentCard?.wrongs).toBe(1)
    store.resumeHelp()
    expect(store.currentCard?.state).toBe('practice')
  })

  it('复测通过：卡片掌握、下一张解锁、写入盲区台账并落盘', () => {
    const store = useRemediationStore()
    const blindspots = useBlindspotsStore()
    const { graph, summary } = fixture()
    store.startFromSummary(graph, summary, [], SUBJECT, 's')
    masterFirstCard(store)

    expect(store.cards[0]?.card.state).toBe('mastered')
    expect(store.cards[1]?.card.state).toBe('practice')
    expect(store.progress).toEqual({ total: 2, mastered: 1, percent: 50 })
    // 盲区台账里该点为 mastered（list 不显示已掌握点）
    expect(blindspots.list(SUBJECT).map((row) => row.id)).not.toContain('a')
    const ledger = readJson<{ byId: Record<string, { status: string; lastLabel: string }> }>(
      'cnmBlind.local.v1',
      (value): value is { byId: Record<string, { status: string; lastLabel: string }> } =>
        typeof value === 'object' && value !== null,
    )
    expect(ledger?.byId.a?.status).toBe('mastered')
    expect(ledger?.byId.a?.lastLabel).toBe('补救复测通过')
    // 计划已落盘
    const saved = localStorage.getItem('cnmRemedy.plan.math.v1')
    expect(saved).toContain('"state":"mastered"')
  })

  it('reset 清空本学科计划', () => {
    const store = useRemediationStore()
    const { graph, summary } = fixture()
    store.startFromSummary(graph, summary, [], SUBJECT, 's')
    store.reset()
    expect(store.plan).toBeNull()
    expect(localStorage.getItem('cnmRemedy.plan.math.v1')).toBeNull()
  })
})

describe('remediation store 复习', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('复习：到期点可用未做过的题复习，通过推进间隔、失败打回练习', () => {
    const store = useRemediationStore()
    const { graph, summary } = fixture()
    store.startFromSummary(graph, summary, [], SUBJECT, 's')
    masterFirstCard(store)
    const card = store.plan?.cards.find((item) => item.topicId === 'a')
    expect(card?.state).toBe('mastered')
    if (!card) throw new Error('card missing')
    const dueAt = card.reviewDueAt ?? 0
    expect(readDueReviewsAll(dueAt + 1).map((item) => item.topicId)).toContain('a')

    // 复习出题：来自未做过的题
    const question = store.reviewQuestionFor('a')
    expect(question).toBeTruthy()
    expect(store.plan?.usedIds).not.toContain(question?.id)
    // 通过：间隔推进到 3 天（从本次复习时间重排）
    const reviewAt = Date.parse('2026-11-10T09:00:00+08:00')
    vi.useFakeTimers()
    vi.setSystemTime(reviewAt)
    store.answerReview('a', true)
    vi.useRealTimers()
    const advanced = store.plan?.cards.find((item) => item.topicId === 'a')
    expect(advanced?.reviewDueAt).toBe(reviewAt + 3 * 86400000)
    expect(readDueReviewsAll(dueAt + 1).map((item) => item.topicId)).not.toContain('a')
    // 失败：打回练习
    store.answerReview('a', false)
    expect(store.plan?.cards.find((item) => item.topicId === 'a')?.state).toBe('practice')
  })
})
