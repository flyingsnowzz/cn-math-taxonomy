import type { WechatAdapter, WechatProfile } from './types.js'
import { config } from '../config.js'
import { HttpError } from '../middleware/errors.js'

interface AccessTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  openid?: string
  scope?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

interface UserInfoResponse {
  openid?: string
  nickname?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

const API_BASE = 'https://api.weixin.qq.com'

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new HttpError(502, '微信服务暂时不可用', 'wechat_unavailable')
  }
  return (await res.json()) as Record<string, unknown>
}

function ensureOk(payload: AccessTokenResponse | UserInfoResponse): void {
  if (typeof payload.errcode === 'number' && payload.errcode !== 0) {
    // 不向客户端透传微信侧 errcode/errmsg
    throw new HttpError(400, '微信授权失败，请重新登录', 'wechat_auth_failed')
  }
  if (!payload.openid) {
    throw new HttpError(400, '微信授权失败，请重新登录', 'wechat_auth_failed')
  }
}

export function createTencentWechatAdapter(): WechatAdapter {
  const { openAppId, openSecret, mpAppId, mpSecret } = config.wechat
  if (!openAppId || !openSecret || !mpAppId || !mpSecret) {
    throw new Error('微信配置不完整：需要开放平台与服务号 AppID/Secret')
  }

  async function codeExchange(appId: string, secret: string, code: string, userinfo: boolean): Promise<WechatProfile> {
    const tokenUrl = new URL(`${API_BASE}/sns/oauth2/access_token`)
    tokenUrl.searchParams.set('appid', appId)
    tokenUrl.searchParams.set('secret', secret)
    tokenUrl.searchParams.set('code', code)
    tokenUrl.searchParams.set('grant_type', 'authorization_code')
    const token = (await fetchJson(tokenUrl.toString())) as AccessTokenResponse
    ensureOk(token)

    let nickname: string | undefined
    if (userinfo && token.access_token) {
      const infoUrl = new URL(`${API_BASE}/sns/userinfo`)
      infoUrl.searchParams.set('access_token', token.access_token)
      infoUrl.searchParams.set('openid', token.openid as string)
      const info = (await fetchJson(infoUrl.toString())) as UserInfoResponse
      ensureOk(info)
      nickname = info.nickname
    }

    return {
      openid: token.openid as string,
      unionid: token.unionid ?? undefined,
      nickname,
    }
  }

  return {
    exchangeOpenCode(code) {
      // snsapi_login 返回里含 unionid（应用绑定开放平台时）
      return codeExchange(openAppId, openSecret, code, false)
    },
    async exchangeMpCode(code) {
      // snsapi_userinfo 需要拉一次用户信息
      return codeExchange(mpAppId, mpSecret, code, true)
    },
    openAuthorizeUrl(redirectUri, state) {
      const url = new URL('https://open.weixin.qq.com/connect/qrconnect')
      url.searchParams.set('appid', openAppId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'snsapi_login')
      url.searchParams.set('state', state)
      return `${url.toString()}#wechat_redirect`
    },
    mpAuthorizeUrl(redirectUri, state) {
      const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize')
      url.searchParams.set('appid', mpAppId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'snsapi_userinfo')
      url.searchParams.set('state', state)
      return `${url.toString()}#wechat_redirect`
    },
  }
}
