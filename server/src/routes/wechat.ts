import { Router } from 'express'
import { wechat } from '../adapters/index.js'
import { HttpError } from '../middleware/errors.js'
import { requireObject, stringField } from '../middleware/validate.js'
import { createOauthState, verifyOauthState } from '../services/oauthState.js'
import { issueTokenPair } from '../services/tokens.js'
import { getEntitlements } from '../services/users.js'
import { loginWithWechat, type WechatProvider } from '../services/wechatAuth.js'
import type { Request } from 'express'

export const wechatRouter = Router()

const PUBLIC_REDIRECT_PREFIXES = ['http://', 'https://', 'zyxw://', '/']

function safeRedirect(redirect: string): string {
  if (!PUBLIC_REDIRECT_PREFIXES.some((prefix) => redirect.startsWith(prefix))) {
    throw new HttpError(400, '回调地址不合法', 'invalid_redirect')
  }
  return redirect
}

async function tokenResponse(userId: string, userAgent?: string) {
  const pair = await issueTokenPair(userId, userAgent)
  return {
    ...pair,
    user: {
      id: String(userId),
      entitlements: await getEntitlements(userId),
    },
  }
}

/** PC 扫码：取授权跳转地址与 state（state 内含签名的回调页地址）。 */
wechatRouter.get('/auth/wechat/url', (req, res, next) => {
  try {
    const redirectRaw = typeof req.query.redirect === 'string' ? req.query.redirect : ''
    const redirect = safeRedirect(redirectRaw)
    const state = createOauthState(redirect)
    res.json({ url: wechat.openAuthorizeUrl(redirect, state), state })
  } catch (error) {
    next(error)
  }
})

/** PC 扫码回调：开放平台网站应用 code 换身份。 */
wechatRouter.post('/auth/wechat/callback', async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const code = stringField(body, 'code')
    const state = stringField(body, 'state')
    try {
      verifyOauthState(state)
    } catch (error) {
      throw new HttpError(400, (error as Error).message === 'state_expired' ? '授权已过期，请重试' : '授权状态无效，请重试', 'invalid_state')
    }
    const profile = await wechat.exchangeOpenCode(code)
    const userId = await loginWithWechat('wechat_open', profile)
    res.json(await tokenResponse(userId, req.header('user-agent')))
  } catch (error) {
    if (error instanceof HttpError) {
      next(error)
      return
    }
    next(new HttpError(400, '微信授权失败，请重新登录', 'wechat_auth_failed'))
  }
})

/**
 * 微信内服务号网页授权回调。
 * 同时支持：GET（浏览器被微信重定向带 query，直接返回 JSON 供前端取）与
 * POST（前端拿到 code 后提交）。
 */
async function handleMp(req: Request, res: Parameters<Parameters<typeof wechatRouter.get>[1]>[1], next: Parameters<Parameters<typeof wechatRouter.get>[1]>[2]) {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!code || !state) {
      throw new HttpError(400, '缺少微信授权参数', 'invalid_state')
    }
    try {
      verifyOauthState(state)
    } catch (error) {
      throw new HttpError(400, (error as Error).message === 'state_expired' ? '授权已过期，请重试' : '授权状态无效，请重试', 'invalid_state')
    }
    const profile = await wechat.exchangeMpCode(code)
    const userId = await loginWithWechat('wechat_mp', profile)
    res.json(await tokenResponse(userId, req.header('user-agent')))
  } catch (error) {
    next(error)
  }
}
wechatRouter.get('/auth/wechat/mp', handleMp)

/** 前端发起微信内授权时取跳转地址。 */
wechatRouter.post('/auth/wechat/mp/url', (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const redirect = safeRedirect(stringField(body, 'redirect'))
    const state = createOauthState(redirect)
    res.json({ url: wechat.mpAuthorizeUrl(redirect, state), state })
  } catch (error) {
    next(error)
  }
})

// 暴露 provider 类型便于测试/前端契约
export type { WechatProvider }
