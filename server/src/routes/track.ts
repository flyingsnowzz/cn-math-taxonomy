import { Router } from 'express'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { HttpError } from '../middleware/errors.js'
import { requireObject } from '../middleware/validate.js'
import { getPool } from '../db/pool.js'

export const trackRouter = Router()

const MAX_BATCH = 100
const ALLOWED_NAMES = new Set([
  'diagnose_start',
  'diagnose_done',
  'practice_start',
  'practice_done',
  'help_view',
  'retest_pass',
  'report_share',
  'video_open',
  'paywall_view',
])

interface IncomingEvent {
  uid?: unknown
  name?: unknown
  payload?: unknown
  clientAt?: unknown
}

trackRouter.post('/track', optionalAuth, async (req, res, next) => {
  try {
    const body = requireObject(req.body)
    if (!Array.isArray(body.events)) {
      throw new HttpError(400, 'events 必须是数组', 'invalid_field')
    }
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 80) : null

    const raw = body.events as IncomingEvent[]
    const truncated = raw.length > MAX_BATCH
    const events = raw.slice(0, MAX_BATCH)

    let accepted = 0
    let duplicates = 0
    let invalid = 0
    const pool = getPool()

    for (const event of events) {
      if (
        typeof event.uid !== 'string' || event.uid.length === 0 || event.uid.length > 80
        || typeof event.name !== 'string' || !ALLOWED_NAMES.has(event.name)
      ) {
        invalid += 1
        continue
      }
      const payload = typeof event.payload === 'object' && event.payload !== null ? event.payload : {}
      const clientAt = typeof event.clientAt === 'string' && !Number.isNaN(Date.parse(event.clientAt))
        ? event.clientAt
        : null

      const { rowCount } = await pool.query(
        `INSERT INTO events(user_id, client_uid, name, payload, client_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (client_uid) WHERE client_uid IS NOT NULL DO NOTHING`,
        [req.user?.id ?? null, event.uid, event.name, JSON.stringify(payload), clientAt],
      )
      if (rowCount) accepted += 1
      else duplicates += 1
    }

    // 超限或含无效项：明确告诉客户端这批被部分丢弃
    const status = truncated || invalid > 0 ? 202 : 200
    res.status(status).json({
      accepted,
      duplicates,
      invalid,
      dropped: truncated ? raw.length - MAX_BATCH : 0,
      anonymous: !req.user,
      deviceId,
    })
  } catch (error) {
    next(error)
  }
})
