// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { clearEvents, readEvents, track } from '@/utils/track'

describe('本地埋点', () => {
  beforeEach(() => localStorage.clear())

  it('按顺序记录事件，含时间与载荷', () => {
    track('diagnose_start', { subject: 'math' })
    track('practice_start', { topic: 'cnm_148' })
    const events = readEvents()
    expect(events).toHaveLength(2)
    expect(events[0]!.name).toBe('diagnose_start')
    expect(events[0]!.payload).toMatchObject({ subject: 'math' })
    expect(new Date(events[1]!.at).getTime()).toBeGreaterThan(0)
  })

  it('超过 1000 条只保留最新的 1000 条', () => {
    for (let i = 0; i < 1005; i++) track('help_view', { i })
    const events = readEvents()
    expect(events).toHaveLength(1000)
    expect(events[0]!.payload).toMatchObject({ i: 5 })
    expect(events[999]!.payload).toMatchObject({ i: 1004 })
  })

  it('坏数据回退为空，clearEvents 清空', () => {
    localStorage.setItem('cnmTrack.v1', '{bad')
    expect(readEvents()).toEqual([])
    track('report_share')
    clearEvents()
    expect(readEvents()).toEqual([])
  })
})
