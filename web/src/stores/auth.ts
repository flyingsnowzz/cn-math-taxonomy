import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { readJson, remove, writeJson } from '@/utils/storage'
import { ApiError, api, setRefreshHandler, setTokens, setUnauthorizedHandler } from '@/api/client'
import { syncManager } from '@/sync'
import { disableTrackingTransport, enableTrackingTransport } from '@/utils/track'

export interface Entitlements {
  member: boolean
  expireAt: string | null
  source: string
}

export interface AuthUser {
  id: string
  phone?: string | null
  nickname?: string | null
  entitlements?: Entitlements
}

interface StoredSession {
  v: 1
  accessToken: string
  refreshToken: string
  user: AuthUser
}

const STORAGE_KEY = 'cnmAuth.v1'

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.v === 1 &&
    typeof record.accessToken === 'string' &&
    typeof record.refreshToken === 'string' &&
    typeof record.user === 'object'
  )
}

interface TokenResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export const useAuthStore = defineStore('auth', () => {
  const stored = readJson<StoredSession>(STORAGE_KEY, isStoredSession)
  const accessToken = ref(stored?.accessToken ?? null)
  const refreshTokenValue = ref(stored?.refreshToken ?? null)
  const user = ref<AuthUser | null>(stored?.user ?? null)
  const lastError = ref('')

  function persist(session: TokenResponse): void {
    accessToken.value = session.accessToken
    refreshTokenValue.value = session.refreshToken
    user.value = session.user
    const file: StoredSession = { v: 1, ...session }
    writeJson(STORAGE_KEY, file)
    setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken })
  }

  function clearSession(): void {
    disableTrackingTransport()
    accessToken.value = null
    refreshTokenValue.value = null
    user.value = null
    remove(STORAGE_KEY)
    setTokens(null)
  }

  // 客户端模块初始化：把当前令牌交给 API 层
  setTokens(
    stored ? { accessToken: stored.accessToken, refreshToken: stored.refreshToken } : null,
  )
  setUnauthorizedHandler(() => {
    // 刷新失败/无有效会话时清登录态，但不打断公开页面
    clearSession()
  })
  setRefreshHandler(async () => {
    if (!refreshTokenValue.value) return null
    try {
      const next = await api.post<TokenResponse>('/auth/refresh', {
        refreshToken: refreshTokenValue.value,
      }, false)
      persist(next)
      return { accessToken: next.accessToken, refreshToken: next.refreshToken }
    } catch {
      clearSession()
      return null
    }
  })

  async function requestSmsCode(phone: string): Promise<{ devCode?: string }> {
    lastError.value = ''
    return api.post('/auth/sms/request', { phone }, false)
  }

  async function loginWithSms(phone: string, code: string): Promise<void> {
    lastError.value = ''
    persist(await api.post<TokenResponse>('/auth/sms/verify', { phone, code }, false))
    await syncManager.login()
    enableTrackingTransport()
  }

  async function loginWithPassword(account: string, password: string): Promise<void> {
    lastError.value = ''
    persist(await api.post<TokenResponse>('/auth/password/login', { account, password }, false))
    await syncManager.login()
    enableTrackingTransport()
  }

  /** 用微信回调 code/state 完成登录（provider 决定开放平台或服务号）。 */
  async function loginWithWechat(provider: 'open' | 'mp', code: string, state: string): Promise<void> {
    lastError.value = ''
    if (provider === 'open') {
      persist(await api.post<TokenResponse>('/auth/wechat/callback', { code, state }, false))
    } else {
      persist(await api.get<TokenResponse>(`/auth/wechat/mp?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`))
    }
    await syncManager.login()
    enableTrackingTransport()
  }

  /** PC 扫码：返回微信授权地址，前端跳转。 */
  async function startWechatOpen(redirectUri: string): Promise<string> {
    const body = await api.get<{ url: string; state: string }>(
      `/auth/wechat/url?redirect=${encodeURIComponent(redirectUri)}`,
    )
    return body.url
  }

  /** 微信内：返回服务号网页授权地址。 */
  async function startWechatMp(redirectUri: string): Promise<string> {
    const body = await api.post<{ url: string; state: string }>('/auth/wechat/mp/url', {
      redirect: redirectUri,
    }, false)
    return body.url
  }

  async function logout(): Promise<void> {
    syncManager.logout()
    disableTrackingTransport()
    if (refreshTokenValue.value) {
      try {
        await api.post('/auth/logout', { refreshToken: refreshTokenValue.value }, true)
      } catch {
        // 即使后端吊销失败也清本地
      }
    }
    clearSession()
  }

  async function initSyncIfLoggedIn(): Promise<void> {
    if (accessToken.value) {
      await syncManager.login()
      enableTrackingTransport()
    }
  }

  async function fetchMe(): Promise<void> {
    const me = await api.get<AuthUser>('/me')
    user.value = me
    if (accessToken.value && refreshTokenValue.value) {
      writeJson(STORAGE_KEY, {
        v: 1,
        accessToken: accessToken.value,
        refreshToken: refreshTokenValue.value,
        user: me,
      } satisfies StoredSession)
    }
  }

  const isLoggedIn = computed(() => !!accessToken.value)
  const entitlements = computed<Entitlements | null>(() => user.value?.entitlements ?? null)
  const isMember = computed(() => entitlements.value?.member === true)
  const displayName = computed(() => user.value?.nickname || maskPhone(user.value?.phone) || '已登录')

  return {
    user,
    accessToken,
    isLoggedIn,
    isMember,
    entitlements,
    displayName,
    lastError,
    requestSmsCode,
    loginWithSms,
    loginWithPassword,
    loginWithWechat,
    startWechatOpen,
    startWechatMp,
    logout,
    fetchMe,
    initSyncIfLoggedIn,
    clearSession,
  }
})

function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone.length !== 11) return phone ?? ''
  return `${phone.slice(0, 3)}****${phone.slice(7)}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return '网络异常，请稍后再试'
}
