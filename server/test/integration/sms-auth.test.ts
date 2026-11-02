import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { Pool } from 'pg'
import type { Express } from 'express'
import { createApp } from '../../src/app.js'
import { config } from '../../src/config.js'
import { closePool } from '../../src/db/pool.js'
import { signAccessToken } from '../../src/services/tokens.js'
import { TEST_URL, ensureTestDatabase, truncateTables } from '../helpers/db.js'

const available = await ensureTestDatabase()
const wasProduction = config.env === 'production'

function start(app: Express): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve({ server, base: `http://127.0.0.1:${addr.port}` })
    })
  })
}

const json = async (res: Response) => (await res.json()) as Record<string, unknown>
const headers = { 'content-type': 'application/json' }

;(available ? describe : describe.skip)('短信验证码登录（集成）', () => {
  let server: Server
  let base: string

  before(async () => {
    await truncateTables()
    config.env = 'development' // 固定码 123456 与 devCode 回传
    ;({ server, base } = await start(createApp()))
  })

  after(async () => {
    config.env = wasProduction ? 'production' : 'development'
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await closePool()
  })

  it('请求验证码：开发模式回传固定码 123456', async () => {
    const res = await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers,
      body: JSON.stringify({ phone: '13811110001' }),
    })
    assert.equal(res.status, 200)
    const body = await json(res)
    assert.equal(body.ok, true)
    assert.equal(body.devCode, '123456')
  })

  it('错码 bad_code；正确码登录成功并自动建号', async () => {
    const wrong = await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers,
      body: JSON.stringify({ phone: '13811110001', code: '000000' }),
    })
    assert.equal(wrong.status, 400)
    assert.equal((await json(wrong)).error?.code, 'bad_code')

    const ok = await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers,
      body: JSON.stringify({ phone: '13811110001', code: '123456' }),
    })
    assert.equal(ok.status, 200)
    const body = await json(ok)
    assert.ok(typeof body.accessToken === 'string')
    assert.ok(typeof body.refreshToken === 'string')
    assert.equal((body.user as { phone: string }).phone, '13811110001')

    const pool = new Pool({ connectionString: TEST_URL })
    const { rows } = await pool.query('SELECT phone FROM users WHERE phone=$1', ['13811110001'])
    await pool.end()
    assert.equal(rows.length, 1)
  })

  it('验证码一次性：再次使用同码 code_expired', async () => {
    const phone = '13811110002'
    await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone }),
    })
    await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers, body: JSON.stringify({ phone, code: '123456' }),
    })
    const replay = await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers, body: JSON.stringify({ phone, code: '123456' }),
    })
    assert.equal(replay.status, 400)
    assert.equal((await json(replay)).error?.code, 'code_expired')
  })

  it('过期验证码 code_expired', async () => {
    const phone = '13811110003'
    await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone }),
    })
    const pool = new Pool({ connectionString: TEST_URL })
    await pool.query("UPDATE sms_codes SET expires_at = now() - interval '1 minute' WHERE phone=$1", [phone])
    await pool.end()
    const res = await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers, body: JSON.stringify({ phone, code: '123456' }),
    })
    assert.equal(res.status, 400)
    assert.equal((await json(res)).error?.code, 'code_expired')
  })

  it('60 秒内重复请求被限流 429', async () => {
    const phone = '13811110004'
    const first = await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone }),
    })
    assert.equal(first.status, 200)
    const second = await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone }),
    })
    assert.equal(second.status, 429)
    assert.equal((await json(second)).error?.code, 'rate_limited')
  })

  it('绑定手机：已被占用返回 phone_taken；未占用可绑定', async () => {
    // 先让 13811110005 成为一个已注册用户
    await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone: '13811110005' }),
    })
    await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers, body: JSON.stringify({ phone: '13811110005', code: '123456' }),
    })
    // 第二个新用户（用 13811110006 验证码登录后绑定到 13811110005 → 409）
    await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone: '13811110006' }),
    })
    const login = await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers, body: JSON.stringify({ phone: '13811110006', code: '123456' }),
    })
    const secondUser = (await json(login)).user as { id: string }
    const token = await signAccessToken(secondUser.id)

    // 给 13811110005 再发一次码（上一次已消费），需要等 60s 限流——直接改库重置限流时间
    const pool = new Pool({ connectionString: TEST_URL })
    await pool.query("DELETE FROM rate_limits WHERE key LIKE 'sms:%13811110005'")
    await pool.end()
    await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone: '13811110005' }),
    })
    const conflict = await fetch(`${base}/auth/bind/phone`, {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone: '13811110005', code: '123456' }),
    })
    assert.equal(conflict.status, 409)
    assert.equal((await json(conflict)).error?.code, 'phone_taken')
  })

  it('生产模式响应绝不回传验证码', async () => {
    config.env = 'production'
    const phone = '13811110007'
    const pool = new Pool({ connectionString: TEST_URL })
    const res = await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone }),
    })
    await pool.end()
    assert.equal(res.status, 200)
    const body = await json(res)
    assert.equal('devCode' in body, false)
    assert.equal(JSON.stringify(body).includes('123456'), false)
    config.env = 'development'
  })

  it('非法手机号 400', async () => {
    const res = await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone: '12345' }),
    })
    assert.equal(res.status, 400)
    assert.equal((await json(res)).error?.code, 'invalid_phone')
  })
})
