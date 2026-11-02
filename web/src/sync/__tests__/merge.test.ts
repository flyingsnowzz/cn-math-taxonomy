import { describe, expect, it } from 'vitest'
import { isSyncKey, mergeBlob, specForKey } from '../merge'

describe('mergeBlob', () => {
  const planKey = 'cnmRemedy.plan.math.v1'

  it('lww：远端新则覆盖，本地新则保留', () => {
    const remote = { cards: [{ id: 'r' }] }
    const local = { cards: [{ id: 'l' }] }
    expect(mergeBlob(planKey, remote, local, 100, 200).data).toEqual(remote)
    expect(mergeBlob(planKey, remote, local, 300, 200).data).toEqual(local)
    expect(mergeBlob(planKey, remote, local, 300, 200).changed).toBe(false)
  })

  it('shortfall 字符串数组取并集，不重复', () => {
    const r = mergeBlob('cnmRemedy.shortfall.v1', ['a', 'b'], ['b', 'c'], 0, 0)
    expect(r.data).toEqual(['a', 'b', 'c'])
    expect(r.changed).toBe(true)
    const noChange = mergeBlob('cnmRemedy.shortfall.v1', ['b'], ['b', 'c'], 0, 0)
    expect(noChange.changed).toBe(false)
  })

  it('盲区台账：新条目并入，同条目计数取大、mastered 优先、lastAt 取新', () => {
    const remote = { v: 1, byId: {
      t1: { id: 't1', status: 'weak', wrongs: 5, hits: 1, lastAt: '2026-10-01', subject: 'math' },
      t2: { id: 't2', status: 'mastered', wrongs: 0, hits: 3, lastAt: '2026-10-02', subject: 'math' },
    } }
    const local = { v: 1, byId: {
      t1: { id: 't1', status: 'weak', wrongs: 2, hits: 4, lastAt: '2026-11-01', subject: 'math' },
    } }
    const r = mergeBlob('cnmBlind.local.v1', remote, local, 0, 0)
    const byId = (r.data as { byId: Record<string, { wrongs: number; hits: number; lastAt: string; status: string }> }).byId
    expect(byId.t1?.wrongs).toBe(5)
    expect(byId.t1?.hits).toBe(4)
    expect(byId.t1?.lastAt).toBe('2026-11-01')
    expect(byId.t2?.status).toBe('mastered')
  })

  it('孩子档案：按 id 合并，updatedAt 新者覆盖，current 保持有效', () => {
    const remote = { v: 1, current: 'c1', children: [
      { id: 'c1', name: '新名', createdAt: '2026-01-01', updatedAt: '2026-03-01' },
      { id: 'c2', name: '二宝', createdAt: '2026-02-01' },
    ] }
    const local = { v: 1, current: 'gone', children: [
      { id: 'c1', name: '旧名', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ] }
    const r = mergeBlob('cnmChildren.v1', remote, local, 0, 0)
    const data = r.data as { children: Array<{ id: string; name?: string }>; current: string | null }
    expect(data.children).toHaveLength(2)
    expect(data.children.find((c) => c.id === 'c1')?.name).toBe('新名')
    expect(['c1', 'c2']).toContain(data.current)
  })

  it('孩子记录：按 key 去重合并，最多保留 40 条', () => {
    const remote = { c1: [{ key: 'r1', savedAt: '2026-01-01' }, { key: 'r2', savedAt: '2026-02-01' }] }
    const local = { c1: [{ key: 'r1', savedAt: '2026-01-01' }, { key: 'r3', savedAt: '2026-03-01' }] }
    const r = mergeBlob('cnmChildren.records.v1', remote, local, 0, 0)
    expect((r.data as Record<string, Array<{ key: string }>>).c1?.map((x) => x.key)).toEqual(['r1', 'r2', 'r3'])
  })

  it('白名单：账号/会话键不被同步', () => {
    expect(isSyncKey('cnmAuth.v1')).toBe(false)
    expect(isSyncKey('cnmDiagnose.session.v2')).toBe(false)
    expect(isSyncKey('cnmFeature.remedy.v1')).toBe(false)
    expect(specForKey('cnmRemedy.plan.math.v1')?.strategy).toBe('lww')
  })
})
