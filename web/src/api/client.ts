/**
 * 后端 API 客户端。
 * - baseURL 由 VITE_API_BASE_URL 指定；缺省为空字符串=同源（未配置后端时不影响纯本地功能）。
 * - 自动携带 access token；401 时用 refresh token 静默刷新一次并重放原请求。
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  auth?: boolean
}

let accessToken: string | null = null
let refreshToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setTokens(tokens: Pick<TokenPair, 'accessToken' | 'refreshToken'> | null): void {
  accessToken = tokens?.accessToken ?? null
  refreshToken = tokens?.refreshToken ?? null
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

/** 由 auth store 提供：用 refreshToken 换令牌对；失败抛错。 */
let refreshHandler: (() => Promise<TokenPair | null>) | null = null
export function setRefreshHandler(handler: () => Promise<TokenPair | null>): void {
  refreshHandler = handler
}

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`
}

async function rawRequest(path: string, options: RequestOptions & { token?: string }): Promise<Response> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`
  return fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

async function parseError(response: Response): Promise<ApiError> {
  let code = 'error'
  let message = '请求失败'
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } }
    code = body.error?.code ?? code
    message = body.error?.message ?? message
  } catch {
    // 非 JSON 错误响应
  }
  return new ApiError(response.status, code, message)
}

async function request<T>(path: string, options: RequestOptions = {}, retrying = false): Promise<T> {
  const response = await rawRequest(path, {
    ...options,
    token: options.auth === false ? undefined : accessToken ?? undefined,
  })

  if (response.status === 401 && !retrying && refreshToken && refreshHandler) {
    const next = await refreshHandler()
    if (next) {
      accessToken = next.accessToken
      refreshToken = next.refreshToken
      return request<T>(path, options, true)
    }
  }

  if (!response.ok) {
    const error = await parseError(response)
    if (response.status === 401) onUnauthorized?.()
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = false) => request<T>(path, { method: 'POST', body, auth }),
}
