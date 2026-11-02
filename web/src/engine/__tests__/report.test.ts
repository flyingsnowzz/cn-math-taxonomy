// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  buildReport,
  decodePublicReport,
  encodePublicReport,
  formatDuration,
  toPublicReport,
  type ReportContext,
} from '../report'
import type { RemedyPlan } from '../remediationAdapter'

const T0 = Date.parse('2026-11-02T10:00:00+08:00')

function makeCard(overrides: Partial<RemedyPlan['cards'][number]>): RemedyPlan['cards'][number] {
  return {
    topicId: 'a',
    kind: 'weak',
    isRoot: false,
    isTarget: false,
    order: 0,
    state: 'practice',
    unlocked: true,
    practice: [],
    retest: [],
    cursor: 0,
    phase: 'practice',
    wrongs: 0,
    practiceShortfall: false,
    retestShortfall: false,
    masteredAt: null,
    reviewStep: 0,
    reviewDueAt: null,
    ...overrides,
  }
}

const ctx: ReportContext = {
  subject: 'math',
  resolveTopic: (id) => ({ name: `知识点${id}`, chapter: `九上 第${id}章` }),
  now: T0,
}

function planWith(states: Array<[string, RemedyPlan['cards'][number]['state'], number | null]>): RemedyPlan {
  return {
    v: 1,
    createdAt: T0,
    targets: ['c'],
    usedIds: ['q1', 'q2', 'q3'],
    cards: states.map(([id, state, masteredAt], index) =>
      makeCard({
        topicId: id,
        order: index,
        state,
        isRoot: index === 0,
        isTarget: id === 'c',
        kind: 'weak',
        masteredAt,
        wrongs: state === 'mastered' ? 1 : 2,
      }),
    ),
  }
}

describe('buildReport', () => {
  it('全部掌握：进度 100%，有总用时，路径按计划顺序', () => {
    const plan = planWith([
      ['a', 'mastered', T0 + 5 * 60000],
      ['b', 'mastered', T0 + 12 * 60000],
    ])
    const report = buildReport(plan, ctx)
    expect(report.totals).toMatchObject({ cards: 2, mastered: 2, remaining: 0, roots: 1, rootsMastered: 1 })
    expect(report.path.map((item) => item.id)).toEqual(['a', 'b'])
    expect(report.durationMs).toBe(12 * 60000)
    expect(formatDuration(report.durationMs)).toContain('12')
  })

  it('部分掌握：统计已补/剩余，用时只算到最后一次通过', () => {
    const plan = planWith([
      ['a', 'mastered', T0 + 3 * 60000],
      ['b', 'help', null],
      ['c', 'locked', null],
    ])
    const report = buildReport(plan, ctx)
    expect(report.totals.mastered).toBe(1)
    expect(report.totals.remaining).toBe(2)
    expect(report.durationMs).toBe(3 * 60000)
  })

  it('零完成：用时为占位符，计数全 0', () => {
    const plan = planWith([['a', 'practice', null]])
    const report = buildReport(plan, ctx)
    expect(report.totals.mastered).toBe(0)
    expect(report.durationMs).toBeNull()
    expect(formatDuration(null)).toBe('—')
  })
})

describe('公开摘要版', () => {
  it('白名单字段，不含内部 id，且可编解码往返', () => {
    const report = buildReport(planWith([['a', 'mastered', T0]]), ctx)
    const pub = toPublicReport(report)
    expect(pub.path[0]).not.toHaveProperty('id')
    expect(pub.path[0]).toMatchObject({ name: '知识点a', mastered: true })

    const encoded = encodePublicReport(pub)
    expect(encoded).not.toMatch(/[+/=]/)
    const decoded = decodePublicReport(encoded)
    expect(decoded).toEqual(pub)
  })

  it('坏数据返回 null', () => {
    expect(decodePublicReport('***')).toBeNull()
  })
})
