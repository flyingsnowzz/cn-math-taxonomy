// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../auth'

const TOKEN_PAIR = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: { id: '7', phone: '13800000000', entitlements: { member: false, expireAt: null, source: 'manual' } },
}

function mockFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Array<{ url: string; method: string; auth?: string; body?: string }> = []
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? 'GET',
      auth: (init.headers as Record<string, string>)?.authorization,
      body: typeof init.body === 'string' ? init.body : undefined,
    })
    const next = queue.shift() ?? { status: 500, body: { error: { code: 'x', message: 'x' } } }
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }))
  return calls
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('短信验证码登录成功：持久化令牌、标记已登录', async () => {
    mockFetch([{ body: { ok: true, devCode: '123456' } }, { body: TOKEN_PAIR }])
    const auth = useAuthStore()
    await auth.requestSmsCode('13800000000')
    await auth.loginWithSms('13800000000', '123456')
    expect(auth.isLoggedIn).toBe(true)
    expect(auth.displayName).toContain('****')
    const stored = JSON.parse(localStorage.getItem('cnmAuth.v1') ?? '{}')
    expect(stored.v).toBe(1)
    expect(stored.accessToken).toBe('access-1')
  })

  it('登录失败抛出后端中文错误，不写本地会话', async () => {
    mockFetch([{ status: 400, body: { error: { code: 'bad_code', message: '验证码不正确' } } }])
    const auth = useAuthStore()
    await expect(auth.loginWithSms('13800000000', '000000')).rejects.toThrow('验证码不正确')
    expect(auth.isLoggedIn).toBe(false)
    expect(localStorage.getItem('cnmAuth.v1')).toBeNull()
  })

  it('401 时自动用 refresh 换令牌并重放原请求（带新 token）', async () => {
    const calls = mockFetch([
      { status: 401, body: { error: { code: 'invalid_token', message: '过期' } } },
      { body: { accessToken: 'access-2', refreshToken: 'refresh-2', user: TOKEN_PAIR.user } },
      { body: { ok: true } },
    ])
    // 直接预置持久化会话，新建 store 后读取
    localStorage.setItem('cnmAuth.v1', JSON.stringify({ v: 1, ...TOKEN_PAIR }))
    // 重新创建 store 读取持久化会话
    setActivePinia(createPinia())
    const reloaded = useAuthStore()
    expect(reloaded.isLoggedIn).toBe(true)
    const { api } = await import('@/api/client')
    await api.post('/track', { x: 1 }, true)
    expect(calls).toHaveLength(3)
    expect(calls[0]?.auth).toBe('Bearer access-1')
    expect(JSON.parse(calls[1]?.body ?? '{}').refreshToken).toBe('refresh-1')
    expect(calls[2]?.auth).toBe('Bearer access-2')
    expect(reloaded.accessToken).toBe('access-2')
  })

  it('refresh 也失败：清空会话，之后为未登录', async () => {
    mockFetch([
      { status: 401, body: { error: { code: 'invalid_token', message: '过期' } } },
      { status: 401, body: { error: { code: 'invalid_refresh', message: '刷新令牌无效' } } },
    ])
    localStorage.setItem('cnmAuth.v1', JSON.stringify({ v: 1, ...TOKEN_PAIR }))
    setActivePinia(createPinia())
    const auth = useAuthStore()
    const { api } = await import('@/api/client')
    await expect(api.get('/me')).rejects.toThrow()
    expect(auth.isLoggedIn).toBe(false)
    expect(localStorage.getItem('cnmAuth.v1')).toBeNull()
  })

  it('退出登录调用 /auth/logout 并清除本地会话', async () => {
    mockFetch([{ body: { ok: true } }])
    localStorage.setItem('cnmAuth.v1', JSON.stringify({ v: 1, ...TOKEN_PAIR }))
    setActivePinia(createPinia())
    const reloaded = useAuthStore()
    await reloaded.logout()
    expect(reloaded.isLoggedIn).toBe(false)
    expect(localStorage.getItem('cnmAuth.v1')).toBeNull()
  })
})
