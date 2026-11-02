import { Router } from 'express'
import { HttpError } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { requireObject } from '../middleware/validate.js'
import { getPool } from '../db/pool.js'

export const syncRouter = Router()

/**
 * 允许同步的本地键白名单（账号令牌、诊断临时会话、功能开关不同步）：
 * - cnmRemedy.plan.<subject>.v1   补救计划
 * - cnmRemedy.shortfall.v1        缺题点
 * - cnmBlind.local.v1             盲区台账
 * - cnmChildren.v1 / .records.v1  孩子档案与诊断历史
 */
const KEY_PATTERNS: RegExp[] = [
  /^cnmRemedy\.plan\.[a-z]+\.v1$/,
  /^cnmRemedy\.shortfall\.v1$/,
  /^cnmBlind\.local\.v1$/,
  /^cnmChildren\.v1$/,
  /^cnmChildren\.records\.v1$/,
]

const MAX_ITEM_BYTES = 256 * 1024

function assertAllowedKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !KEY_PATTERNS.some((pattern) => pattern.test(key))) {
    throw new HttpError(400, '不允许同步的数据键', 'invalid_sync_key')
  }
}

function assertBlob(value: unknown): void {
  const size = Buffer.byteLength(JSON.stringify(value), 'utf8')
  if (size > MAX_ITEM_BYTES) {
    throw new HttpError(413, `单项数据超过 ${Math.round(MAX_ITEM_BYTES / 1024)}KB 上限`, 'sync_item_too_large')
  }
}

syncRouter.get('/sync', requireAuth, async (req, res, next) => {
  try {
    const raw = typeof req.query.keys === 'string' ? req.query.keys : ''
    const keys = raw.split(',').map((k) => k.trim()).filter(Boolean)
    keys.forEach(assertAllowedKey)

    if (keys.length === 0) {
      res.json({ items: [] })
      return
    }
    const { rows } = await getPool().query<{ key: string; data: unknown; updated_at: string }>(
      `SELECT key, data, updated_at FROM sync_blobs
       WHERE user_id = $1 AND key = ANY($2::text[])`,
      [req.user!.id, keys],
    )
    res.json({
      items: rows.map((row) => ({ key: row.key, data: row.data, updatedAt: Number(row.updated_at) })),
    })
  } catch (error) {
    next(error)
  }
})

syncRouter.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    if (!Array.isArray(body.items)) {
      throw new HttpError(400, 'items 必须是数组', 'invalid_field')
    }

    const results: Array<{ key: string; updatedAt: number; changed: boolean }> = []
    const pool = getPool()

    for (const item of body.items as unknown[]) {
      if (typeof item !== 'object' || item === null) {
        throw new HttpError(400, '同步项格式不正确', 'invalid_field')
      }
      const record = item as { key?: unknown; data?: unknown; updatedAt?: unknown }
      assertAllowedKey(record.key)
      assertBlob(record.data)
      if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt) || record.updatedAt <= 0) {
        throw new HttpError(400, 'updatedAt 必须是正整数毫秒时间戳', 'invalid_timestamp')
      }
      const key = record.key
      const incomingAt = Math.trunc(record.updatedAt)

      const existing = await pool.query<{ updated_at: string }>(
        'SELECT updated_at FROM sync_blobs WHERE user_id=$1 AND key=$2',
        [req.user!.id, key],
      )
      const serverAt = existing.rows[0] ? Number(existing.rows[0].updated_at) : null
      const changed = serverAt === null || incomingAt > serverAt

      if (changed) {
        await pool.query(
          `INSERT INTO sync_blobs(user_id, key, data, updated_at)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (user_id, key) DO UPDATE
             SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, server_at = now()`,
          [req.user!.id, key, JSON.stringify(record.data), incomingAt],
        )
      }
      results.push({ key, updatedAt: changed ? incomingAt : serverAt as number, changed })
    }
    res.json({ items: results })
  } catch (error) {
    next(error)
  }
})
