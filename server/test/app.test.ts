import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import type { Server } from 'node:http'
import { Pool } from 'pg'
import { createApp } from '../src/app.js'
import { setPool } from '../src/db/pool.js'

function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        resolve({ server, base: `http://127.0.0.1:${address.port}` })
      }
    })
  })
}

async function get(base: string, path: string): Promise<Response> {
  return fetch(base + path)
}

describe('HTTP 骨架', () => {
  let server: Server
  let base: string

  before(async () => {
    // 指向一个不可用的数据库，验证健康检查在 DB 不可达时降级为 503 而非 500
    setPool(new Pool({ connectionString: 'postgres://nobody@127.0.0.1:1/none', connectionTimeoutMillis: 200 }))
    ;({ server, base } = await listen(createApp()))
  })

  after(async () => {
    setPool(null)
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('根路径返回服务信息', async () => {
    const res = await get(base, '/')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.service, 'cnm-server')
  })

  it('数据库不可达时 /healthz 返回 503 与 db:down', async () => {
    const res = await get(base, '/healthz')
    assert.equal(res.status, 503)
    const body = await res.json()
    assert.equal(body.ok, false)
    assert.equal(body.db, 'down')
  })

  it('未知路径返回 JSON 404（而不是 HTML）', async () => {
    const res = await get(base, '/nope')
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.error.code, 'not_found')
  })

  it('OPTIONS 预检返回 204 与 CORS 头', async () => {
    const res = await fetch(base + '/sync', { method: 'OPTIONS' })
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('access-control-allow-methods')?.includes('POST'), true)
  })

  it('请求体超过 1MB 时返回 413', async () => {
    const res = await fetch(base + '/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: [ { payload: 'x'.repeat(1_100_000) } ] }),
    })
    assert.equal(res.status, 413)
  })
})
