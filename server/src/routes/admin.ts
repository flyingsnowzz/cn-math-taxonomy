import { Router } from 'express'
import { requireAdmin } from '../middleware/adminAuth.js'
import { HttpError } from '../middleware/errors.js'
import { normalizePhone, requireObject } from '../middleware/validate.js'
import { getPool } from '../db/pool.js'
import { findUserByPhone, getEntitlements } from '../services/users.js'

export const adminRouter = Router()

function expireAt(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new HttpError(400, 'expireAt 必须是 ISO 时间、毫秒时间戳或 null', 'invalid_expire_at')
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'expireAt 不是有效时间', 'invalid_expire_at')
  }
  return date
}

adminRouter.post('/admin/users/:phone/entitlements', requireAdmin, async (req, res, next) => {
  try {
    const phone = normalizePhone(req.params.phone)
    const body = requireObject(req.body)
    if (typeof body.member !== 'boolean') {
      throw new HttpError(400, 'member 必须是布尔值', 'invalid_member')
    }
    const source = body.source === undefined ? 'manual' : body.source
    if (typeof source !== 'string' || !source.trim() || source.length > 40) {
      throw new HttpError(400, 'source 必须是 1–40 位字符串', 'invalid_source')
    }
    const expires = expireAt(body.expireAt)
    const user = await findUserByPhone(phone)
    if (!user) throw new HttpError(404, '用户不存在', 'not_found')

    await getPool().query(
      `INSERT INTO entitlements(user_id, member, expire_at, source, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE SET
         member = EXCLUDED.member,
         expire_at = EXCLUDED.expire_at,
         source = EXCLUDED.source,
         updated_at = now()`,
      [user.id, body.member, expires, source.trim()],
    )
    const entitlements = await getEntitlements(user.id)
    console.info(JSON.stringify({
      type: 'entitlement_admin_update',
      userId: user.id,
      phone,
      member: body.member,
      expireAt: expires?.toISOString() ?? null,
      source: source.trim(),
    }))
    res.json({ id: user.id, phone, entitlements })
  } catch (error) {
    next(error)
  }
})
