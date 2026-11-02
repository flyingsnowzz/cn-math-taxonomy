import { Router, type Request } from 'express'
import { config } from '../config.js'
import { sms } from '../adapters/index.js'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { normalizePhone, requireObject, stringField } from '../middleware/validate.js'
import { hitRateLimit } from '../services/rateLimit.js'
import { consumeCode, generateCode, SmsCodeError, storeCode } from '../services/smsCodes.js'
import { issueTokenPair } from '../services/tokens.js'
import {
  bindPhone,
  findOrCreateUserByPhone,
  getEntitlements,
  PhoneTaken,
} from '../services/users.js'

export const smsRouter = Router()

function clientIp(req: Request): string {
  const fwd = req.header('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || req.ip || 'unknown'
}

async function enforceSmsRateLimit(req: Request, phone: string): Promise<void> {
  const checks: Array<{ key: string; window: number; max: number }> = [
    { key: `sms:60:${phone}`, window: 60, max: 1 },
    { key: `sms:day:${phone}`, window: 24 * 3600, max: 10 },
    { key: `sms:ip:${clientIp(req)}`, window: 3600, max: 30 },
  ]
  for (const check of checks) {
    const result = await hitRateLimit(check.key, check.window, check.max)
    if (!result.allowed) {
      throw new HttpError(429, '请求过于频繁，请稍后再试', 'rate_limited')
    }
  }
}

smsRouter.post('/auth/sms/request', async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const phone = normalizePhone(stringField(body, 'phone'))
    await enforceSmsRateLimit(req, phone)

    const code = generateCode()
    await storeCode(phone, code)
    try {
      await sms.sendCode(phone, code)
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(502, '短信发送失败，请稍后再试', 'sms_send_failed')
    }

    // 仅非生产回传固定码，方便开发与种子用户测试；生产响应不含验证码。
    const response: { ok: true; devCode?: string } = { ok: true }
    if (config.env !== 'production') response.devCode = code
    res.json(response)
  } catch (error) {
    next(error)
  }
})

smsRouter.post('/auth/sms/verify', async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const phone = normalizePhone(stringField(body, 'phone'))
    const code = stringField(body, 'code')
    try {
      await consumeCode(phone, code)
    } catch (error) {
      if (error instanceof SmsCodeError) {
        throw new HttpError(400, error.message, error.code)
      }
      throw error
    }
    const user = await findOrCreateUserByPhone(phone)
    const pair = await issueTokenPair(user.id, req.header('user-agent'))
    res.json({
      ...pair,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        entitlements: await getEntitlements(user.id),
      },
    })
  } catch (error) {
    next(error)
  }
})

smsRouter.post('/auth/bind/phone', requireAuth, async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    const phone = normalizePhone(stringField(body, 'phone'))
    const code = stringField(body, 'code')
    try {
      await consumeCode(phone, code)
    } catch (error) {
      if (error instanceof SmsCodeError) {
        throw new HttpError(400, error.message, error.code)
      }
      throw error
    }
    try {
      await bindPhone(req.user!.id, phone)
    } catch (error) {
      if (error instanceof PhoneTaken) {
        throw new HttpError(409, '该手机号已被其他账号绑定', 'phone_taken')
      }
      throw error
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
