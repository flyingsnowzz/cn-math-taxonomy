import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import type { Express } from 'express'
import { createApp } from '../../src/app.js'
import { closePool } from '../../src/db/pool.js'
import { config } from '../../src/config.js'
import { signAccessToken } from '../../src/services/tokens.js'
import { createUserWithPhone } from '../../src/services/users.js'
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

const headers = { 'content-type': 'application/json' }
const adminHeaders = {
  ...headers,
  authorization: `Basic ${Buffer.from('admin:test-admin-password').toString('base64')}`,
}

;(available ? describe : describe.skip)('内部管理 / 会员权益（集成）', () => {
  let server: Server
  let base: string
  let userId: string
  let accessToken: string
  let originalPassword: string
  const phone = '13800000077'

  before(async () => {
    originalPassword = config.adminPassword
    config.adminPassword = 'test-admin-password'
    await truncateTables()
    const user = await createUserWithPhone(phone)
    userId = user.id
    accessToken = await signAccessToken(user.id)
    ;({ server, base } = await start(createApp()))
  })

  after(async () => {
    config.adminPassword = originalPassword
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await closePool()
  })

  it('管理接口拒绝无凭证和错误凭证', async () => {
    const path = `${base}/admin/users/${phone}/entitlements`
    const missing = await fetch(path, { method: 'POST', headers, body: JSON.stringify({ member: true }) })
    assert.equal(missing.status, 401)
    assert.equal(missing.headers.get('www-authenticate')?.includes('Basic'), true)

    const wrong = await fetch(path, {
      method: 'POST',
      headers: { ...headers, authorization: `Basic ${Buffer.from('admin:wrong-password').toString('base64')}` },
      body: JSON.stringify({ member: true }),
    })
    assert.equal(wrong.status, 401)
  })

  it('手工开通写真实记录，重新拉 /me 后为会员并记录审计日志', async () => {
    const logs: string[] = []
    const originalInfo = console.info
    console.info = (message?: unknown) => { logs.push(String(message)) }
    try {
      const res = await fetch(`${base}/admin/users/${phone}/entitlements`, {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ member: true, expireAt: '2027-12-31T23:59:59Z', source: 'manual_seed' }),
      })
      assert.equal(res.status, 200)
      const body = await res.json()
      assert.equal(body.entitlements.member, true)
      assert.equal(body.entitlements.source, 'manual_seed')
    } finally {
      console.info = originalInfo
    }
    assert.ok(logs.some((line) => line.includes('entitlement_admin_update') && line.includes(userId)))

    const me = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${accessToken}` } })
    const body = await me.json()
    assert.equal(body.entitlements.member, true)
    assert.equal(body.entitlements.expireAt, '2027-12-31T23:59:59.000Z')
  })

  it('过期权益不会解锁，重复设置可撤销会员', async () => {
    const path = `${base}/admin/users/${phone}/entitlements`
    const expired = await fetch(path, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ member: true, expireAt: '2020-01-01T00:00:00Z', source: 'manual' }),
    })
    assert.equal(expired.status, 200)
    assert.equal((await expired.json()).entitlements.member, false)

    const revoked = await fetch(path, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ member: false, expireAt: null, source: 'manual' }),
    })
    assert.equal(revoked.status, 200)
    const me = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${accessToken}` } })
    assert.equal((await me.json()).entitlements.member, false)
  })

  it('非法输入 400，不存在用户 404', async () => {
    const invalid = await fetch(`${base}/admin/users/${phone}/entitlements`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ member: 'yes' }),
    })
    assert.equal(invalid.status, 400)
    assert.equal((await invalid.json()).error.code, 'invalid_member')

    const missing = await fetch(`${base}/admin/users/13800000078/entitlements`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ member: true }),
    })
    assert.equal(missing.status, 404)
  })
})
