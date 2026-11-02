import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import { config } from '../config.js'
import { getPool } from '../db/pool.js'
import { randomToken, sha256 } from './crypto.js'

const ACCESS_TTL_SEC = 7 * 24 * 3600 // 7 天
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000 // 30 天
const ISSUER = 'cnm-server'
const AUDIENCE = 'cnm-web'

export interface AccessClaims {
  sub: string
}

export class TokenError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret)
}

export async function signAccessToken(userId: string | number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secretKey())
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE })
    if (!payload.sub) throw new TokenError('invalid_token', '令牌缺少用户')
    return { sub: payload.sub }
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new TokenError('token_expired', '登录已过期')
    }
    throw new TokenError('invalid_token', '登录状态无效')
  }
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

/** 签发新令牌对并把 refresh（哈希后）落库。 */
export async function issueTokenPair(userId: string | number, userAgent?: string): Promise<TokenPair> {
  const refreshToken = randomToken(32)
  await getPool().query(
    `INSERT INTO refresh_tokens(token_hash, user_id, user_agent, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4::bigint))`,
    [sha256(refreshToken), userId, userAgent ?? null, REFRESH_TTL_MS / 1000],
  )
  return { accessToken: await signAccessToken(userId), refreshToken }
}

/** 校验 refresh：存在、未吊销、未过期。 */
async function loadRefresh(refreshToken: string) {
  const { rows } = await getPool().query<{
    token_hash: string
    user_id: string
    user_agent: string | null
    expires_at: Date
    revoked_at: Date | null
  }>(
    `SELECT token_hash, user_id, user_agent, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [sha256(refreshToken)],
  )
  return rows[0] ?? null
}

/** 旋转：旧 refresh 吊销，发新令牌对；旧令牌重放一律拒绝。 */
export async function rotateRefreshToken(
  refreshToken: string,
  userAgent?: string,
): Promise<TokenPair> {
  const row = await loadRefresh(refreshToken)
  if (!row || row.revoked_at || row.expires_at.getTime() < Date.now()) {
    throw new TokenError('invalid_refresh', '刷新令牌无效或已过期')
  }
  await getPool().query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1',
    [row.token_hash],
  )
  return issueTokenPair(row.user_id, userAgent)
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await getPool().query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [sha256(refreshToken)],
  )
}
