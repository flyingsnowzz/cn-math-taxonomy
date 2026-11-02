import { getPool } from '../db/pool.js'

export interface RateResult {
  allowed: boolean
  count: number
}

/**
 * 固定窗口限流，窗口结束后重新计数。
 * 例如 key='sms:138...'，windowSec=60，max=1。
 */
export async function hitRateLimit(key: string, windowSec: number, max: number): Promise<RateResult> {
  const pool = getPool()
  const { rows } = await pool.query<{ count: number; window_start: string }>(
    `INSERT INTO rate_limits(key, window_start, count)
     VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::int)
                    THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::int)
                           THEN now() ELSE rate_limits.window_start END
     RETURNING count, window_start`,
    [key, windowSec],
  )
  return { allowed: rows[0].count <= max, count: rows[0].count }
}
