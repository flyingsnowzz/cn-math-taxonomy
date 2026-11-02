import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const TOKEN_PAIR = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: { id: '7', phone: '13800000000', nickname: null, entitlements: { member: false, expireAt: null, source: 'manual' } },
}

const seedEvents = [
  { name: 'diagnose_start', at: '2026-11-02T10:00:00Z', uid: 'u-1', payload: { subject: 'math' } },
  { name: 'practice_start', at: '2026-11-02T10:01:00Z', uid: 'u-2', payload: { topic: 'cnm_148' } },
]

async function setup(page: import('@playwright/test').Page) {
  await page.addInitScript((events) => {
    localStorage.setItem('cnmTrack.v1', JSON.stringify(events))
  }, seedEvents)
  await page.route('**/auth/sms/request', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/auth/sms/verify', (r) => r.fulfill({ json: TOKEN_PAIR }))
  await page.route((url) => url.pathname === '/sync', (r) => r.fulfill({ json: { items: [] } }))
  await page.route('**/me', (r) => r.fulfill({ json: TOKEN_PAIR.user }))
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('[data-test="login-phone"]').fill('13800000000')
  await page.getByRole('button', { name: '获取验证码' }).click()
  await page.locator('[data-test="login-code"]').fill('123456')
  await page.getByRole('button', { name: '登录 / 注册' }).click()
  await expect(page.locator('[data-test="nav-account"]')).toBeVisible()
}

test.describe('埋点上报', () => {
  test('登录后把本地待上报事件带上 uid/deviceId 批量上报，成功后标记已上传', async ({ page }) => {
    await setup(page)
    interface TrackPayload { deviceId: string; events: Array<{ uid: string; name: string; clientAt: string }> }
    const posts: Array<{ headers: Record<string, string>; body: TrackPayload }> = []
    await page.route(
      (url) => url.pathname === '/track',
      async (route) => {
        posts.push({ headers: route.request().headers(), body: JSON.parse(route.request().postData() ?? '{}') as TrackPayload })
        await route.fulfill({ json: { accepted: 2 } })
      },
    )
    await login(page)
    await expect.poll(() => posts.length, { timeout: 5000 }).toBeGreaterThan(0)
    expect(posts[0]?.headers.authorization).toBe('Bearer access-1')
    expect(posts[0]?.body.events.map((e) => e.name)).toEqual(['diagnose_start', 'practice_start'])
    expect(posts[0]?.body.events[0].uid).toBe('u-1')
    expect(posts[0]?.body.deviceId).toMatch(/^dev-/)

    await expect.poll(
      () => page.evaluate(() => (JSON.parse(localStorage.getItem('cnmTrack.v1') ?? '[]') as Array<{ uploaded?: boolean }>).every((e) => e.uploaded === true)),
      { timeout: 5000 },
    ).toBe(true)
  })

  test('上报失败保留本地，online 后补报成功', async ({ page }) => {
    await setup(page)
    let attempts = 0
    await page.route(
      (url) => url.pathname === '/track',
      async (route) => {
        attempts += 1
        if (attempts === 1) return route.fulfill({ status: 500, body: 'x' })
        await route.fulfill({ json: { accepted: 2 } })
      },
    )
    await login(page)
    await expect.poll(() => attempts, { timeout: 5000 }).toBe(1)
    // 失败后本地仍待上报
    const stillPending = await page.evaluate(() =>
      (JSON.parse(localStorage.getItem('cnmTrack.v1') ?? '[]') as Array<{ uploaded?: boolean }>).every((e) => e.uploaded !== true))
    expect(stillPending).toBe(true)

    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => attempts, { timeout: 5000 }).toBe(2)
    await expect.poll(
      () => page.evaluate(() => (JSON.parse(localStorage.getItem('cnmTrack.v1') ?? '[]') as Array<{ uploaded?: boolean }>).every((e) => e.uploaded === true)),
      { timeout: 5000 },
    ).toBe(true)
  })
})
