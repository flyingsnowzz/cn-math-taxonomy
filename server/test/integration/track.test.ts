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
const event = (uid: string, name = 'practice_start') => ({
  uid, name, payload: { topic: 'cnm_148' }, clientAt: '2026-11-02T10:00:00Z',
})

;(available ? describe : describe.skip)('/track 埋点上报（集成）', () => {
  let server: Server
  let base: string

  before(async () => {
    await truncateTables()
    ;({ server, base } = await start(createApp()))
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await closePool()
  })

  it('匿名批量上报成功，deviceId 被接受', async () => {
    const res = await fetch(`${base}/track`, {
      method: 'POST', headers,
      body: JSON.stringify({ deviceId: 'dev-abc', events: [event('u1'), event('u2', 'help_view')] }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.accepted, 2)
    assert.equal(body.anonymous, true)
    assert.equal(body.deviceId, 'dev-abc')
  })

  it('重复 client_uid 去重，不插两条', async () => {
    const res = await fetch(`${base}/track`, {
      method: 'POST', headers,
      body: JSON.stringify({ events: [event('u1'), event('u3')] }),
    })
    const body = await res.json()
    assert.equal(body.duplicates, 1)
    assert.equal(body.accepted, 1)

    const pool = new Pool({ connectionString: TEST_URL })
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM events WHERE client_uid=$1', ['u1'])
    await pool.end()
    assert.equal(rows[0].n, 1)
  })

  it('非法事件名被丢弃并返回 202', async () => {
    const res = await fetch(`${base}/track`, {
      method: 'POST', headers,
      body: JSON.stringify({ events: [event('u4', 'dance')] }),
    })
    assert.equal(res.status, 202)
    const body = await res.json()
    assert.equal(body.invalid, 1)
  })

  it('超过 100 条只收前 100 条并返回 202', async () => {
    const events = Array.from({ length: 105 }, (_, i) => event(`bulk-${i}`))
    const res = await fetch(`${base}/track`, {
      method: 'POST', headers,
      body: JSON.stringify({ events }),
    })
    assert.equal(res.status, 202)
    const body = await res.json()
    assert.equal(body.accepted, 100)
    assert.equal(body.dropped, 5)
  })
})
