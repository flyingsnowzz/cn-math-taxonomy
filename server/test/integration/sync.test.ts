import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { after, before, describe, it } from 'node:test'
import { Pool } from 'pg'
import type { Express } from 'express'
import { createApp } from '../../src/app.js'
import { closePool } from '../../src/db/pool.js'
import { TEST_URL, ensureTestDatabase, truncateTables } from '../helpers/db.js'

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

;(available ? describe : describe.skip)('/sync 云同步（集成）', () => {
  let server: Server
  let base: string
  let tokenA: string
  let tokenB: string

  async function login(phone: string): Promise<string> {
    await fetch(`${base}/auth/sms/request`, {
      method: 'POST', headers, body: JSON.stringify({ phone }),
    })
    const res = await fetch(`${base}/auth/sms/verify`, {
      method: 'POST', headers, body: JSON.stringify({ phone, code: '123456' }),
    })
    return (await res.json()).accessToken as string
  }

  before(async () => {
    await truncateTables()
    ;({ server, base } = await start(createApp()))
    tokenA = await login('13822220001')
    tokenB = await login('13822220002')
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await closePool()
  })

  const planKey = 'cnmRemedy.plan.math.v1'

  it('未登录 401', async () => {
    const res = await fetch(`${base}/sync?keys=${planKey}`)
    assert.equal(res.status, 401)
  })

  it('写入后可读回，且只返回白名单内的键', async () => {
    const res = await fetch(`${base}/sync`, {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ items: [{ key: planKey, data: { a: 1 }, updatedAt: 1000 }] }),
    })
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).items[0], { key: planKey, updatedAt: 1000, changed: true })

    const got = await fetch(`${base}/sync?keys=${planKey}`, {
      headers: { authorization: `Bearer ${tokenA}` },
    })
    const body = await got.json()
    assert.equal(body.items[0].data.a, 1)
    assert.equal(body.items[0].updatedAt, 1000)
  })

  it('旧时间戳不覆盖新数据（last-write-wins）', async () => {
    const auth = { ...headers, authorization: `Bearer ${tokenA}` }
    const older = await fetch(`${base}/sync`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ items: [{ key: planKey, data: { a: 999 }, updatedAt: 500 }] }),
    })
    assert.equal((await older.json()).items[0].changed, false)

    const got = await fetch(`${base}/sync?keys=${planKey}`, { headers: { authorization: `Bearer ${tokenA}` } })
    assert.equal((await got.json()).items[0].data.a, 1)
  })

  it('白名单外的键 400；非法时间戳 400；超大项 413', async () => {
    const auth = { ...headers, authorization: `Bearer ${tokenA}` }
    const badKey = await fetch(`${base}/sync`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ items: [{ key: 'cnmAuth.v1', data: {}, updatedAt: 1 }] }),
    })
    assert.equal(badKey.status, 400)
    assert.equal((await badKey.json()).error.code, 'invalid_sync_key')

    const badTime = await fetch(`${base}/sync`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ items: [{ key: 'cnmBlind.local.v1', data: {}, updatedAt: -1 }] }),
    })
    assert.equal(badTime.status, 400)

    const tooBig = await fetch(`${base}/sync`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ items: [{ key: 'cnmBlind.local.v1', data: 'x'.repeat(270_000), updatedAt: 1 }] }),
    })
    assert.equal(tooBig.status, 413)
  })

  it('不同用户数据互相隔离', async () => {
    const gotB = await fetch(`${base}/sync?keys=${planKey}`, {
      headers: { authorization: `Bearer ${tokenB}` },
    })
    assert.deepEqual((await gotB.json()).items, [])

    // B 写入自己的数据后，A 看到的值不变
    await fetch(`${base}/sync`, {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ items: [{ key: planKey, data: { a: 2 }, updatedAt: 2000 }] }),
    })
    const gotA = await fetch(`${base}/sync?keys=${planKey}`, {
      headers: { authorization: `Bearer ${tokenA}` },
    })
    assert.equal((await gotA.json()).items[0].data.a, 1)
  })

  it('其余四类键均可同步', async () => {
    const auth = { ...headers, authorization: `Bearer ${tokenA}` }
    const keys = [
      'cnmRemedy.shortfall.v1',
      'cnmBlind.local.v1',
      'cnmChildren.v1',
      'cnmChildren.records.v1',
    ]
    const res = await fetch(`${base}/sync`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ items: keys.map((key, i) => ({ key, data: { i }, updatedAt: 3000 + i })) }),
    })
    assert.equal(res.status, 200)
    const got = await fetch(`${base}/sync?keys=${keys.join(',')}`, {
      headers: { authorization: `Bearer ${tokenA}` },
    })
    assert.equal((await got.json()).items.length, 4)

    const pool = new Pool({ connectionString: TEST_URL })
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM sync_blobs WHERE user_id=$1', [1])
    await pool.end()
    assert.equal(rows[0].n, 5)
  })
})
