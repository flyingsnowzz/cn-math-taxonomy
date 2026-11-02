import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

/**
 * 无状态 OAuth state：base64url(JSON{redirect,ts}) + HMAC 签名。
 * 防止 CSRF（回调校验签名与时效），无需在服务端存 state。
 */
const TTL_MS = 10 * 60 * 1000

function sign(payload: string): string {
  return createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')
}

export function createOauthState(redirect: string): string {
  const payload = Buffer.from(JSON.stringify({ redirect, ts: Date.now() })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export interface ParsedState {
  redirect: string
}

export function verifyOauthState(state: string): ParsedState {
  const [payload, mac] = state.split('.')
  if (!payload || !mac) {
    throw new Error('invalid_state')
  }
  const expected = sign(payload)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('invalid_state')
  }
  let parsed: { redirect?: unknown; ts?: unknown }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('invalid_state')
  }
  if (typeof parsed.redirect !== 'string' || typeof parsed.ts !== 'number') {
    throw new Error('invalid_state')
  }
  if (Date.now() - parsed.ts > TTL_MS) {
    throw new Error('state_expired')
  }
  return { redirect: parsed.redirect }
}
