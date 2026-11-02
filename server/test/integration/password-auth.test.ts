import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import type { Express } from 'express'
import { createApp } from '../../src/app.js'
import { closePool } from '../../src/db/pool.js'
import { createUserWithPhone, setPassword } from '../../src/services/users.js'
import { ensureTestDatabase, truncateTables } from '../helpers/db.js'

const available = await ensureTestDatabase()

function start(app: Express): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve({ server, base: `http://127.0.0.1:${addr.port}` })
    })
  })
}

const json = async (res: Response) => (await res.json()) as {
  accessToken?: string
  refreshToken?: string
  error?: { code: string; message: string }
  phone?: string
  entitlements?: unknown
}

;(available ? describe : describe.skip)('密码登录 / JWT / /me（集成）', () => {
  let server: Server
  let base: string
  const phone = '13800000001'

  before(async () => {
    await truncateTables()
    ;({ server, base } = await start(createApp()))
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await closePool()
  })

  it('密码登录成功返回令牌对和用户信息', async () => {
    const user = await createUserWithPhone(phone)
    await setPassword(user.id, 'supersecret123')

    const res = await fetch(`${base}/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: phone, password: 'supersecret123' }),
    })
    assert.equal(res.status, 200)
    const body = await json(res)
    assert.match(body.accessToken ?? '', /^[\w-]+\.[\w-]+\.[\w-]+$/)
    assert.ok((body.refreshToken ?? '').length > 30)
    assert.equal(body.user.phone, phone)
    assert.deepEqual(body.user.entitlements, { member: false, expireAt: null, source: 'manual' })
  })

  it('错误密码 401；手机号格式错误 400', async () => {
    const wrong = await fetch(`${base}/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: phone, password: 'nope12345' }),
    })
    assert.equal(wrong.status, 401)
    assert.equal((await json(wrong)).error?.code, 'bad_credentials')

    const badPhone = await fetch(`${base}/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: '123', password: 'whatever1' }),
    })
    assert.equal(badPhone.status, 400)
    assert.equal((await json(badPhone)).error?.code, 'invalid_phone')
  })

  it('无 token 与伪造 token 访问 /me 均为 401', async () => {
    const none = await fetch(`${base}/me`)
    assert.equal(none.status, 401)
    const fake = await fetch(`${base}/me`, { headers: { authorization: 'Bearer not-a-jwt' } })
    assert.equal(fake.status, 401)
  })

  it('补设密码：首次成功，重复设置 409，随后可用新密码登录', async () => {
    const fresh = await createUserWithPhone('13800000002')
    const { signAccessToken } = await import('../../src/services/tokens.js')
    const token = await signAccessToken(fresh.id)

    const first = await fetch(`${base}/auth/password/set`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'firstpass99' }),
    })
    assert.equal(first.status, 200)

    const second = await fetch(`${base}/auth/password/set`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: 'secondpass00' }),
    })
    assert.equal(second.status, 409)
    assert.equal((await json(second)).error?.code, 'password_exists')

    const login = await fetch(`${base}/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: '13800000002', password: 'firstpass99' }),
    })
    assert.equal(login.status, 200)
  })

  it('refresh 旋转：旧令牌失效，新令牌可用；logout 后 refresh 不可用', async () => {
    const login = await fetch(`${base}/auth/password/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: phone, password: 'supersecret123' }),
    })
    const pair = await json(login)

    const refreshed = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: pair.refreshToken }),
    })
    assert.equal(refreshed.status, 200)
    const next = await json(refreshed)
    assert.notEqual(next.accessToken, pair.accessToken)

    const replay = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: pair.refreshToken }),
    })
    assert.equal(replay.status, 401)
    assert.equal((await json(replay)).error?.code, 'invalid_refresh')

    const meRes = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${next.accessToken}` } })
    assert.equal(meRes.status, 200)
    const meBody = await json(meRes)
    assert.equal(meBody.phone, phone)

    const logout = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${next.accessToken}` },
      body: JSON.stringify({ refreshToken: next.refreshToken }),
    })
    assert.equal(logout.status, 200)
    const afterLogout = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: next.refreshToken }),
    })
    assert.equal(afterLogout.status, 401)
  })

  it('密码不明文落库', async () => {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const { rows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE phone=$1',
      [phone],
    )
    await pool.end()
    assert.match(rows[0].password_hash, /^scrypt\$/)
    assert.ok(!rows[0].password_hash.includes('supersecret123'))
  })
})
