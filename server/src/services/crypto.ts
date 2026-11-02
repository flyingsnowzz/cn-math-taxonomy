import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * 密码哈希：node 内置 scrypt，无原生依赖。
 * 存储格式 scrypt$N$r$p$saltB64url$hashB64url，参数写入串中便于以后升级。
 */
const N = 16384
const R = 8
const P = 1
const KEY_LEN = 32
const SALT_LEN = 16

function toB64Url(buf: Buffer): string {
  return buf.toString('base64url')
}

function fromB64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN)
  const derived = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${toB64Url(salt)}$${toB64Url(derived)}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false
  let expected: Buffer
  try {
    expected = scryptSync(password, fromB64Url(parts[4]), KEY_LEN, { N: n, r, p })
  } catch {
    return false
  }
  const actual = fromB64Url(parts[5])
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** 生成 URL 安全的随机令牌原文（刷新令牌/一次性 code 用）。 */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}
