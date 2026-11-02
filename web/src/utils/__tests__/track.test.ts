// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearEvents,
  deviceId,
  disableTrackingTransport,
  enableTrackingTransport,
  flushEvents,
  pendingEvents,
  readEvents,
  track,
} from '@/utils/track'

function okResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('本地埋点', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    disableTrackingTransport()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('按顺序记录事件，含 uid 与载荷', () => {
    track('diagnose_start', { subject: 'math' })
    track('practice_start', { topic: 'cnm_148' })
    const events = readEvents()
    expect(events).toHaveLength(2)
    expect(events[0]?.name).toBe('diagnose_start')
    expect(events[0]?.uid).toBeTruthy()
    expect(events[0]?.payload).toMatchObject({ subject: 'math' })
  })

  it('超过 1000 条只保留最新的 1000 条', () => {
    for (let i = 0; i < 1005; i++) track('help_view', { i })
    const events = readEvents()
    expect(events).toHaveLength(1000)
    expect(events[0]?.payload).toMatchObject({ i: 5 })
  })

  it('坏数据回退为空，clearEvents 清空', () => {
    localStorage.setItem('cnmTrack.v1', '{bad')
    expect(readEvents()).toEqual([])
    track('report_share')
    clearEvents()
    expect(readEvents()).toEqual([])
  })

  it('旧版无 uid 的事件在待上报时补 uid', () => {
    localStorage.setItem('cnmTrack.v1', JSON.stringify([
      { name: 'diagnose_start', at: '2026-01-01T00:00:00Z', payload: {} },
    ]))
    const pending = pendingEvents()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.uid).toBeTruthy()
    expect(readEvents()[0]?.uid).toBe(pending[0]?.uid)
  })

  it('未开启上报时 flush 不发请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    track('practice_start')
    await flushEvents()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('开启后 flush 批量上报并标记已上传；重复 flush 不重发', async () => {
    const bodies: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => {
      bodies.push(JSON.parse(String(init.body)))
      return okResponse({ accepted: 2 })
    }))
    track('practice_start', { topic: 'a' })
    track('help_view')
    enableTrackingTransport(false)
    await flushEvents()
    expect(bodies).toHaveLength(1)
    const sent = bodies[0] as { deviceId: string; events: Array<{ uid: string; name: string; clientAt: string }> }
    expect(sent.deviceId).toBe(deviceId())
    expect(sent.events.map((e) => e.name)).toEqual(['practice_start', 'help_view'])
    expect(sent.events[0]?.uid).toBeTruthy()
    expect(sent.events[0]?.clientAt).toBeTruthy()
    expect(pendingEvents()).toHaveLength(0)

    await flushEvents()
    expect(bodies).toHaveLength(1)
  })

  it('上报失败保留待上报，再次 flush 补报', async () => {
    let attempt = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      attempt += 1
      if (attempt === 1) return new Response('x', { status: 500 })
      return okResponse({ accepted: 1 })
    }))
    track('retest_pass')
    enableTrackingTransport(false)
    await flushEvents()
    expect(pendingEvents()).toHaveLength(1)
    await flushEvents()
    expect(attempt).toBe(2)
    expect(pendingEvents()).toHaveLength(0)
  })
})
