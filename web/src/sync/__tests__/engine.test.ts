// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyncEngine } from '../engine'

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response
}

describe('sync engine', () => {
  const engines: Array<ReturnType<typeof createSyncEngine>> = []
  function makeEngine(events?: Parameters<typeof createSyncEngine>[0]) {
    const engine = createSyncEngine(events)
    engines.push(engine)
    return engine
  }
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    engines.forEach((e) => e.logout())
    engines.length = 0
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('未登录不发任何同步请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const engine = makeEngine()
    engine.markDirty('cnmRemedy.plan.math.v1')
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('markDirty 防抖 2s 批量推送，带上本地时间戳', async () => {
    const calls: Array<{ url: string; body?: string | null }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: typeof init?.body === 'string' ? init.body : null })
      if (String(url).includes('/sync?')) return jsonResponse({ items: [] })
      return jsonResponse({ items: [{ key: 'cnmRemedy.shortfall.v1', updatedAt: 1000, changed: true }] })
    }))
    localStorage.setItem('cnmRemedy.shortfall.v1', JSON.stringify(['t1']))
    const engine = makeEngine()
    await engine.login()
    engine.markDirty('cnmRemedy.shortfall.v1')
    engine.markDirty('cnmRemedy.shortfall.v1')
    const postsBefore = calls.filter((c) => !String(c.url).includes('?'))
    expect(postsBefore).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(2001)
    const posts = calls.filter((c) => c.url.includes('/sync') && !c.url.includes('?'))
    expect(posts).toHaveLength(1)
    const body = JSON.parse(posts[0]?.body ?? '{}')
    expect(body.items[0].key).toBe('cnmRemedy.shortfall.v1')
    expect(body.items[0].data).toEqual(['t1'])
    expect(typeof body.items[0].updatedAt).toBe('number')
    engine.logout()
  })

  it('pull：远端新数据合并入本地并触发回调', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      items: [{
        key: 'cnmRemedy.shortfall.v1',
        data: ['remote1'],
        updatedAt: 5000,
      }],
    })))
    localStorage.setItem('cnmRemedy.shortfall.v1', JSON.stringify(['local1']))
    const merged: string[] = []
    const engine = makeEngine({ onRemoteMerged: (keys) => merged.push(...keys) })
    await engine.login()
    const data = JSON.parse(localStorage.getItem('cnmRemedy.shortfall.v1') ?? '[]')
    expect(data).toEqual(['remote1', 'local1'])
    expect(merged).toContain('cnmRemedy.shortfall.v1')
  })

  it('推送失败时数据保留在 dirty，online 后重试', async () => {
    let attempt = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/sync?')) return jsonResponse({ items: [] })
      attempt += 1
      if (attempt === 1) return new Response('x', { status: 500 })
      return jsonResponse({ items: [{ key: 'cnmBlind.local.v1', updatedAt: 9, changed: true }] })
    }))
    localStorage.setItem('cnmBlind.local.v1', JSON.stringify({ v: 1, byId: {} }))
    const engine = makeEngine()
    await engine.login()
    engine.markDirty('cnmBlind.local.v1')
    await vi.advanceTimersByTimeAsync(2001)
    expect(attempt).toBe(1)
    window.dispatchEvent(new Event('online'))
    await Promise.resolve()
    await vi.runAllTimersAsync()
    expect(attempt).toBe(2)
  })

  it('非白名单键不推送', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const engine = makeEngine()
    await engine.login()
    engine.markDirty('cnmAuth.v1')
    await vi.advanceTimersByTimeAsync(2001)
    const posts = (fetchMock.mock.calls as unknown[][]).filter((call) => String(call[0]).includes('/sync') && !String(call[0]).includes('?'))
    expect(posts).toHaveLength(0)
  })
})
