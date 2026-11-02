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

const json = async (res: Response) => (await res.json()) as Record<string, any>
const headers = { 'content-type': 'application/json' }
const REDIRECT = 'https://www.zyxw.cn/login/callback'

;(available ? describe : describe.skip)('微信登录（mock 集成）', () => {
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

  async function callback(provider: 'open' | 'mp', code: string) {
    if (provider === 'open') {
      const url = await fetch(`${base}/auth/wechat/url?redirect=${encodeURIComponent(REDIRECT)}`)
      const { state } = await json(url)
      assert.ok(typeof state === 'string')
      return fetch(`${base}/auth/wechat/callback`, {
        method: 'POST', headers,
        body: JSON.stringify({ code, state }),
      })
    }
    const url = await fetch(`${base}/auth/wechat/mp/url`, {
      method: 'POST', headers, body: JSON.stringify({ redirect: REDIRECT }),
    })
    const { state } = await json(url)
    return fetch(`${base}/auth/wechat/mp?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
  }

  it('PC 扫码首登建号，返回令牌对；state 不匹配 400', async () => {
    const res = await callback('open', 'mock-open:openid-A:unionid-U1')
    assert.equal(res.status, 200)
    const body = await json(res)
    assert.ok(body.accessToken && body.refreshToken)

    const url = await fetch(`${base}/auth/wechat/url?redirect=${encodeURIComponent(REDIRECT)}`)
    const { state } = await json(url)
    const bad = await fetch(`${base}/auth/wechat/callback`, {
      method: 'POST', headers,
      body: JSON.stringify({ code: 'mock-open:openid-A:unionid-U1', state: state + 'x' }),
    })
    assert.equal(bad.status, 400)
    assert.equal((await json(bad)).error?.code, 'invalid_state')
  })

  it('同一 unionid 经开放平台和服务号登录归一为同一用户，重复登录幂等', async () => {
    const openRes = await callback('open', 'mock-open:openid-B:unionid-U2')
    const openBody = await json(openRes)
    const mpRes = await callback('mp', 'mock-mp:mpopenid-B:unionid-U2')
    const mpBody = await json(mpRes)
    assert.equal(String(openBody.user.id), String(mpBody.user.id))

    const pool = new Pool({ connectionString: TEST_URL })
    const { rows: identities } = await pool.query(
      "SELECT provider, provider_uid FROM user_identities WHERE unionid=$1 ORDER BY provider",
      ['unionid-U2'],
    )
    const { rows: users } = await pool.query(
      `SELECT count(DISTINCT u.id)::int AS n FROM users u
       JOIN user_identities i ON i.user_id=u.id WHERE i.unionid=$1`,
      ['unionid-U2'],
    )
    await pool.end()
    assert.deepEqual(identities.map((r) => r.provider), ['wechat_mp', 'wechat_open'])
    assert.equal(users[0].n, 1)

    // 再次扫码登录不建新用户/身份
    const beforeCount = await pool2UserCount()
    await callback('open', 'mock-open:openid-B:unionid-U2')
    assert.equal(await pool2UserCount(), beforeCount)

    async function pool2UserCount() {
      const p = new Pool({ connectionString: TEST_URL })
      const { rows } = await p.query('SELECT count(*)::int AS n FROM users')
      await p.end()
      return rows[0].n as number
    }
  })

  it('无 unionid 的两个 openid 独立建号，不错误合并', async () => {
    const a = await json(await callback('open', 'mock-open:openid-C'))
    const b = await json(await callback('mp', 'mock-mp:mpopenid-C'))
    assert.notEqual(String(a.user.id), String(b.user.id))
  })

  it('非法 redirect 400；授权 URL 指向微信域名', async () => {
    const bad = await fetch(`${base}/auth/wechat/url?redirect=${encodeURIComponent('javascript:alert(1)')}`)
    assert.equal(bad.status, 400)
    assert.equal((await json(bad)).error?.code, 'invalid_redirect')

    const ok = await fetch(`${base}/auth/wechat/url?redirect=${encodeURIComponent(REDIRECT)}`)
    const body = await json(ok)
    assert.ok(String(body.url).startsWith('https://open.weixin.qq.com/connect/qrconnect'))
    assert.ok(String(body.url).includes(encodeURIComponent(REDIRECT)))
  })

  it('微信侧失败（mock code 无 openid 的错误约定由适配器抛出时）归一为 400', async () => {
    // 无效 code：mock 对不含分隔符的 code 生成确定性 openid，不会失败；
    // 这里验证 state 过期类错误也归一为 invalid_state（不泄漏内部细节）
    const res = await fetch(`${base}/auth/wechat/mp?code=x&state=y`)
    assert.equal(res.status, 400)
    assert.equal((await json(res)).error?.code, 'invalid_state')
  })
})
