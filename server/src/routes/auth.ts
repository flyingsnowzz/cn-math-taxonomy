import { Router, type Request } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { normalizePhone, requireObject, requirePassword, stringField } from '../middleware/validate.js'
import { hitRateLimit } from '../services/rateLimit.js'
import {
  checkPassword,
  findUserByPhone,
  findUserById,
  getEntitlements,
  PasswordAlreadySet,
  setPassword,
} from '../services/users.js'
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken } from '../services/tokens.js'

export const authRouter = Router()

function clientIp(req: Request): string {
  // 云托管通常带 x-forwarded-for；取第一段，兜底远端地址
  const fwd = req.header('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || req.ip || 'unknown'
}

async function publicUser(userId: string | number) {
  const user = await findUserById(userId)
  if (!user) throw new HttpError(404, '用户不存在', 'not_found')
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    entitlements: await getEntitlements(user.id),
  }
}

authRouter.post('/auth/password/login', async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const phone = normalizePhone(stringField(body, 'account'))
    const password = stringField(body, 'password')

    const ip = clientIp(req)
    const limit = await hitRateLimit(`login:${ip}`, 60, 20)
    if (!limit.allowed) throw new HttpError(429, '尝试过于频繁，请稍后再试', 'rate_limited')

    const user = await findUserByPhone(phone)
    // 统一错误，避免通过响应差异枚举已注册手机号
    if (!user || !checkPassword(user, password)) {
      throw new HttpError(401, '手机号或密码不正确', 'bad_credentials')
    }

    const pair = await issueTokenPair(user.id, req.header('user-agent'))
    res.json({ ...pair, user: await publicUser(user.id) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/auth/refresh', async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const refreshToken = stringField(body, 'refreshToken')
    const pair = await rotateRefreshToken(refreshToken, req.header('user-agent'))
    const payload = JSON.parse(Buffer.from(pair.accessToken.split('.')[1], 'base64url').toString('utf8')) as { sub: string }
    res.json({ ...pair, user: await publicUser(payload.sub) })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'invalid_refresh') {
      next(new HttpError(401, '刷新令牌无效或已过期', 'invalid_refresh'))
      return
    }
    next(error)
  }
})

authRouter.post('/auth/logout', requireAuth, async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const refreshToken = stringField(body, 'refreshToken')
    await revokeRefreshToken(refreshToken)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/auth/password/set', requireAuth, async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const password = requirePassword(body.password)
    try {
      await setPassword(req.user!.id, password)
    } catch (error) {
      if (error instanceof PasswordAlreadySet) {
        throw new HttpError(409, '密码已设置', 'password_exists')
      }
      throw error
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json(await publicUser(req.user!.id))
  } catch (error) {
    next(error)
  }
})
