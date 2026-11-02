import { getPool } from '../db/pool.js'
import { hashPassword, verifyPassword } from './crypto.js'

export interface UserRow {
  id: string
  phone: string | null
  password_hash: string | null
  nickname: string | null
  created_at: Date
  updated_at: Date
}

export interface Entitlements {
  member: boolean
  expireAt: string | null
  source: string
}

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE phone = $1', [phone])
  return rows[0] ?? null
}

export async function findUserById(id: string | number): Promise<UserRow | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function createUserWithPhone(phone: string): Promise<UserRow> {
  const { rows } = await getPool().query<UserRow>(
    'INSERT INTO users(phone) VALUES ($1) RETURNING *',
    [phone],
  )
  return rows[0]
}

export async function getEntitlements(userId: string | number): Promise<Entitlements> {
  const { rows } = await getPool().query<{ member: boolean; expire_at: Date | null; source: string }>(
    'SELECT member, expire_at, source FROM entitlements WHERE user_id = $1',
    [userId],
  )
  const row = rows[0]
  if (!row) return { member: false, expireAt: null, source: 'manual' }
  return {
    member: row.member && (!row.expire_at || row.expire_at.getTime() > Date.now()),
    expireAt: row.expire_at ? row.expire_at.toISOString() : null,
    source: row.source,
  }
}

export function checkPassword(user: UserRow, password: string): boolean {
  if (!user.password_hash) return false
  return verifyPassword(password, user.password_hash)
}

export class PasswordAlreadySet extends Error {}

export async function setPassword(userId: string | number, password: string): Promise<void> {
  const { rowCount } = await getPool().query(
    `UPDATE users SET password_hash = $1, updated_at = now()
     WHERE id = $2 AND password_hash IS NULL`,
    [hashPassword(password), userId],
  )
  if (rowCount === 0) throw new PasswordAlreadySet('密码已设置')
}

export class PhoneTaken extends Error {}

/** 绑定/换绑手机号；手机已被其他用户占用抛 PhoneTaken。 */
export async function bindPhone(userId: string | number, phone: string): Promise<void> {
  const existing = await findUserByPhone(phone)
  if (existing && String(existing.id) !== String(userId)) {
    throw new PhoneTaken('该手机号已被绑定')
  }
  await getPool().query(
    'UPDATE users SET phone = $1, updated_at = now() WHERE id = $2',
    [phone, userId],
  )
}

/** 按手机号取用户，没有就创建（短信登录自动注册）。 */
export async function findOrCreateUserByPhone(phone: string): Promise<UserRow> {
  const existing = await findUserByPhone(phone)
  return existing ?? createUserWithPhone(phone)
}
