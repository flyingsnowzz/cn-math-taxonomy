import { getPool } from '../db/pool.js'
import type { WechatProfile } from '../adapters/types.js'
import type { UserRow } from './users.js'

export type WechatProvider = 'wechat_open' | 'wechat_mp'

interface IdentityRow {
  id: string
  user_id: string
  provider: string
  provider_uid: string
  unionid: string | null
}

async function findIdentity(provider: WechatProvider, openid: string): Promise<IdentityRow | null> {
  const { rows } = await getPool().query<IdentityRow>(
    'SELECT * FROM user_identities WHERE provider=$1 AND provider_uid=$2',
    [provider, openid],
  )
  return rows[0] ?? null
}

async function findUserByUnionid(unionid: string, exceptProvider?: WechatProvider, exceptOpenid?: string): Promise<string | null> {
  const { rows } = await getPool().query<{ user_id: string }>(
    `SELECT user_id FROM user_identities
     WHERE unionid=$1
       AND ($2::text IS NULL OR NOT (provider=$2 AND provider_uid=$3))
     LIMIT 1`,
    [unionid, exceptProvider ?? null, exceptOpenid ?? null],
  )
  return rows[0]?.user_id ?? null
}

async function createUserForIdentity(provider: WechatProvider, profile: WechatProfile): Promise<string> {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<Pick<UserRow, 'id'>>(
      'INSERT INTO users(nickname) VALUES ($1) RETURNING id',
      [profile.nickname ?? null],
    )
    const userId = rows[0].id
    await client.query(
      'INSERT INTO user_identities(user_id, provider, provider_uid, unionid) VALUES ($1,$2,$3,$4)',
      [userId, provider, profile.openid, profile.unionid ?? null],
    )
    await client.query('COMMIT')
    return userId
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * 微信身份登录/合并：
 * 1. 身份已存在 → 更新 unionid（以前没有、现在有），返回该用户
 * 2. 有 unionid 且同主体其他身份已存在 → 挂新身份到同一用户（两入口归一）
 * 3. 否则建新用户+身份
 * 重复登录幂等，不重复建用户。
 */
export async function loginWithWechat(provider: WechatProvider, profile: WechatProfile): Promise<string> {
  const existing = await findIdentity(provider, profile.openid)
  if (existing) {
    if (profile.unionid && existing.unionid !== profile.unionid) {
      await getPool().query('UPDATE user_identities SET unionid=$1 WHERE id=$2', [
        profile.unionid,
        existing.id,
      ])
    }
    return existing.user_id
  }

  if (profile.unionid) {
    const owner = await findUserByUnionid(profile.unionid, provider, profile.openid)
    if (owner) {
      await getPool().query(
        'INSERT INTO user_identities(user_id, provider, provider_uid, unionid) VALUES ($1,$2,$3,$4)',
        [owner, provider, profile.openid, profile.unionid],
      )
      return owner
    }
  }

  return createUserForIdentity(provider, profile)
}
