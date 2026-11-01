// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBlindspotsStore } from '../blindspots'
import type { EngineSummary } from '@/engine/engineAdapter'

const summary: EngineSummary = {
  mode: 'target',
  targets: ['cnm_j1'],
  asked: 2,
  limit: 16,
  finished: true,
  limitReached: false,
  mastered: [],
  shaky: [],
  weak: ['cnm_j1'],
  unconfirmed: [],
  untested: [],
  roots: [
    {
      id: 'cnm_j1',
      pendingPrereqs: [],
      outOfScopePrereqs: [],
      externalPrereqs: [],
    },
  ],
  path: [{ id: 'cnm_j1', status: 'weak', isRoot: true, isTarget: true }],
}

describe('blindspots store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('records completed non-demo diagnoses for local retesting', () => {
    const store = useBlindspotsStore()
    const ok = store.noteResult({
      subject: 'math',
      label: '配方法',
      key: 'math|test|cnm_j1',
      demo: false,
      answers: [
        { id: 'cnm_j1', qid: 'q1', result: 'wrong' },
        { id: 'cnm_j1', qid: 'q2', result: 'wrong' },
      ],
      summary,
    })

    expect(ok).toBe(true)
    const rows = store.list('math')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'cnm_j1',
      status: 'weak',
      root: true,
      label: '配方法',
      source: 'local',
      wrongs: 2,
    })
    expect(store.diagnoseHref(['cnm_j1'], 'math')).toBe('/diagnose/?target=cnm_j1')
  })

  it('ignores demo results and reads unfinished sessions', () => {
    const store = useBlindspotsStore()
    store.noteResult({
      subject: 'math',
      label: '演示',
      key: 'demo',
      demo: true,
      answers: [{ id: 'cnm_j1', qid: 'q1', result: 'wrong' }],
      summary,
    })
    expect(store.list('math')).toHaveLength(0)

    localStorage.setItem('cnmDiagnose.session.v2', JSON.stringify({
      v: 2,
      label: '未完成',
      savedAt: '2026-11-01T00:00:00.000Z',
      answers: [{ id: 'cnm_j1', qid: 'q1', result: 'wrong' }],
    }))
    const rows = store.list('math')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'cnm_j1', status: 'shaky', source: 'session' })
  })
})
