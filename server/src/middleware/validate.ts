import { HttpError } from '../middleware/errors.js'

export function requireObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, '请求体必须是对象', 'bad_request')
  }
  return body as Record<string, unknown>
}

export function stringField(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string') {
    throw new HttpError(400, `缺少字段：${field}`, 'invalid_field')
  }
  return value
}

const PHONE_RE = /^1\d{10}$/

export function normalizePhone(raw: string): string {
  const phone = raw.replace(/[\s-]/g, '')
  if (!PHONE_RE.test(phone)) {
    throw new HttpError(400, '手机号格式不正确', 'invalid_phone')
  }
  return phone
}

export function requirePassword(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < 8 || raw.length > 128) {
    throw new HttpError(400, '密码长度需为 8–128 位', 'invalid_password')
  }
  return raw
}
