// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RemedyCard from '../RemedyCard.vue'
import type { RemedyCardView } from '@/stores/remediation'
import type { RemedyCard as RemedyCardData } from '@/engine/remediationAdapter'
import type { Topic } from '@/data/types'

function makeCard(overrides: Partial<RemedyCardData>): RemedyCardData {
  return {
    topicId: 'cnm_1',
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

const topic: Topic = {
  id: 'cnm_1',
  name: '配方法',
  domain: '数与代数',
  grade: 9,
  chapter: '九上 第二十五章',
  type: 'procedural',
}

function mountCard(card: RemedyCardData) {
  const view: RemedyCardView = { card, topic }
  return mount(RemedyCard, {
    props: { view },
    global: {
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('RemedyCard', () => {
  it('未解锁：置灰且无操作入口', () => {
    const wrapper = mountCard(makeCard({ state: 'locked', unlocked: false }))
    expect(wrapper.text()).toContain('配方法')
    expect(wrapper.text()).toContain('未解锁')
    expect(wrapper.find('[data-test="remedy-card-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="remedy-card"]').classes().join(' ')).toContain('opacity')
  })

  it('练习中：显示开始练习动作', () => {
    const wrapper = mountCard(makeCard({ state: 'practice', cursor: 0 }))
    expect(wrapper.text()).toContain('待练习')
    expect(wrapper.find('[data-test="remedy-card-action"]').text()).toContain('开始练习')
  })

  it('help 状态：提示看解析并继续', () => {
    const wrapper = mountCard(makeCard({ state: 'help', cursor: 1, wrongs: 1 }))
    expect(wrapper.find('[data-test="remedy-card-action"]').text()).toContain('查看解析')
    expect(wrapper.text()).toContain('有错题')
  })

  it('复测通过：显示已补上，无操作入口', () => {
    const wrapper = mountCard(
      makeCard({ state: 'mastered', unlocked: true, masteredAt: 1, isRoot: true }),
    )
    expect(wrapper.text()).toContain('已补上')
    expect(wrapper.text()).toContain('根因')
    expect(wrapper.find('[data-test="remedy-card-action"]').exists()).toBe(false)
  })
})
