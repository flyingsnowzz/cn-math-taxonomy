import { randomInt } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { config } from '../config.js'

export const CODE_TTL_SEC = 5 * 60
export const DEV_CODE = '123456'

export class SmsCodeError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

/** 非生产环境固定 123456，便于开发/测试/种子用户；生产随机 6 位。 */
export function generateCode(): string {
  if (config.env !== 'production') return DEV_CODE
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function storeCode(phone: string, code: string): Promise<void> {
  await getPool().query(
    `INSERT INTO sms_codes(phone, code, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3::int))
     ON CONFLICT (phone) DO UPDATE
       SET code = EXCLUDED.code,
           expires_at = EXCLUDED.expires_at,
           consumed = false,
           created_at = now()`,
    [phone, code, CODE_TTL_SEC],
  )
}

/** 校验：未找到/不匹配 → bad_code；已消费或过期 → code_expired。通过即标记消费。 */
export async function consumeCode(phone: string, code: string): Promise<void> {
  const { rows } = await getPool().query<{
    code: string
    expires_at: Date
    consumed: boolean
  }>('SELECT code, expires_at, consumed FROM sms_codes WHERE phone = $1', [phone])

  const row = rows[0]
  if (!row || row.code !== code) {
    throw new SmsCodeError('bad_code', '验证码不正确')
  }
  if (row.consumed || row.expires_at.getTime() < Date.now()) {
    throw new SmsCodeError('code_expired', '验证码已过期，请重新获取')
  }
  await getPool().query('UPDATE sms_codes SET consumed = true WHERE phone = $1', [phone])
}
