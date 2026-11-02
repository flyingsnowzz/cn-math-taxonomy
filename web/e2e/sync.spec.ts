import { expect, test, type Page } from '@playwright/test'

const TOKEN_PAIR = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: { id: '7', phone: '13800000000', nickname: null, entitlements: { member: false, expireAt: null, source: 'manual' } },
}

function makePlan(mastered: number) {
  return {
    v: 1,
    createdAt: 1000,
    targets: ['cnm_221'],
    cards: [
      { topicId: 'cnm_148', kind: 'weak', isRoot: true, isTarget: false, order: 0, state: mastered ? 'mastered' : 'practice', unlocked: true, practice: ['cnm_148_q1'], retest: [], cursor: 0, phase: 'practice', wrongs: 0, practiceShortfall: false, retestShortfall: false, masteredAt: mastered ? 2000 : null, reviewStep: mastered ? 0 : 0, reviewDueAt: mastered ? 3000 : null },
    ],
    usedIds: ['cnm_148_q1'],
  }
}

async function mockApi(page: Page, cloud: Map<string, unknown>, requests: string[]) {
  await page.route('**/auth/sms/request', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/auth/sms/verify', (r) => r.fulfill({ json: TOKEN_PAIR }))
  await page.route('**/auth/refresh', (r) => r.fulfill({ json: TOKEN_PAIR }))
  await page.route('**/me', (r) => r.fulfill({ json: TOKEN_PAIR.user }))

  await page.route((url) => url.pathname === '/sync', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST') {
      requests.push('POST /sync')
      const body = JSON.parse(route.request().postData() ?? '{}')
      for (const item of body.items ?? []) {
        if (typeof item.key === 'string' && item.key.startsWith('cnm')) cloud.set(item.key, item.data)
      }
      await route.fulfill({ json: { items: (body.items ?? []).map((i: { key: string }) => ({ key: i.key, updatedAt: Date.now(), changed: true })) } })
      return
    }
    if (url.search.includes('keys=')) {
      const keys = url.searchParams.get('keys')?.split(',') ?? []
      requests.push('GET /sync')
      await route.fulfill({ json: { items: keys.filter((k) => cloud.has(k)).map((k) => ({ key: k, data: cloud.get(k), updatedAt: 9999 })) } })
      return
    }
    await route.fulfill({ json: { items: [] } })
  })
}

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('[data-test="login-phone"]').fill('13800000000')
  await page.getByRole('button', { name: '获取验证码' }).click()
  await page.locator('[data-test="login-code"]').fill('123456')
  await page.getByRole('button', { name: '登录 / 注册' }).click()
  await expect(page.locator('[data-test="nav-account"]')).toBeVisible()
}

// Service Worker 会绕过 Playwright route；同步测试必须直接拦截网络。
test.use({ serviceWorkers: 'block' })

test.describe('云同步', () => {
  test('未登录：诊断/补救流程不发任何 /sync 请求', async ({ page }) => {
    const requests: string[] = []
    await page.route((url) => url.pathname === '/sync', (route) => {
      requests.push(route.request().method() + ' ' + route.request().url())
      route.fulfill({ status: 200, json: { items: [] } })
    })
    await page.goto('/diagnose/?target=cnm_221&demo=1')
    await expect(page.getByText(/诊断结果：配方法/)).toBeVisible({ timeout: 20_000 })
    await page.goto('/remedy/')
    await page.waitForTimeout(500)
    expect(requests).toEqual([])
  })

  test('登录后拉取云端计划：第二台设备看到同样的进度', async ({ page, browser }) => {
    const cloud = new Map<string, unknown>()
    cloud.set('cnmRemedy.plan.math.v1', { v: 1, subject: 'math', plan: makePlan(1), savedAt: new Date().toISOString() })

    const requests: string[] = []
    await mockApi(page, cloud, requests)
    await login(page)
    await expect.poll(() => requests.filter((r) => r === 'GET /sync').length, { timeout: 5000 }).toBeGreaterThan(0)
    await expect.poll(
      () => page.evaluate(() => localStorage.getItem('cnmRemedy.plan.math.v1') !== null),
      { timeout: 5000 },
    ).toBe(true)

    await page.goto('/remedy/')
    await expect(page.locator('[data-test="remedy-progress"]')).toContainText('1 / 1')

    // 模拟第二台设备：新上下文登录，从云端拉到同一份计划
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    const req2: string[] = []
    await mockApi(page2, cloud, req2)
    await login(page2)
    await expect.poll(
      () => page2.evaluate(() => localStorage.getItem('cnmRemedy.plan.math.v1') !== null),
      { timeout: 5000 },
    ).toBe(true)
    await page2.goto('/remedy/')
    await expect(page2.locator('[data-test="remedy-progress"]')).toContainText('1 / 1')
    await ctx2.close()
  })

  test('本地变更防抖推送，且只推白名单键', async ({ page }) => {
    const cloud = new Map<string, unknown>()
    const requests: string[] = []
    await mockApi(page, cloud, requests)
    await login(page)
    await page.waitForTimeout(300)
    requests.length = 0

    // 补救计划变更（通过 legacy 钩子模拟一次本地写入，和 store 写入走同一路径）
    await page.evaluate((plan) => {
      localStorage.setItem('cnmRemedy.plan.math.v1', JSON.stringify({ v: 1, subject: 'math', plan, savedAt: new Date().toISOString() }))
      ;(window as unknown as { __cnmSyncDirty: (k: string) => void }).__cnmSyncDirty('cnmRemedy.plan.math.v1')
    }, makePlan(0))
    await expect.poll(() => requests.filter((r) => r === 'POST /sync').length, { timeout: 5000 }).toBeGreaterThanOrEqual(1)
    expect(cloud.has('cnmRemedy.plan.math.v1')).toBe(true)

    // 非白名单键不推
    requests.length = 0
    await page.evaluate(() => {
      ;(window as unknown as { __cnmSyncDirty: (k: string) => void }).__cnmSyncDirty('cnmAuth.v1')
    })
    await page.waitForTimeout(2500)
    expect(requests.filter((r) => r === 'POST /sync')).toHaveLength(0)
  })

  test('推送失败后断网恢复，online 时重试成功', async ({ page }) => {
    let attempts = 0
    await page.route('**/auth/sms/request', (r) => r.fulfill({ json: { ok: true } }))
    await page.route('**/auth/sms/verify', (r) => r.fulfill({ json: TOKEN_PAIR }))
    await page.route((url) => url.pathname === '/sync', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      attempts += 1
      if (attempts === 1) return route.fulfill({ status: 500, body: 'x' })
      const body = JSON.parse(route.request().postData() ?? '{}')
      return route.fulfill({ json: { items: (body.items ?? []).map((i: { key: string }) => ({ key: i.key, updatedAt: 1, changed: true })) } })
    })
    await page.goto('/login')
    await page.locator('[data-test="login-phone"]').fill('13800000000')
    await page.getByRole('button', { name: '获取验证码' }).click()
    await page.locator('[data-test="login-code"]').fill('123456')
    await page.getByRole('button', { name: '登录 / 注册' }).click()
    await expect(page.locator('[data-test="nav-account"]')).toBeVisible()

    await page.evaluate(() => {
      localStorage.setItem('cnmRemedy.shortfall.v1', JSON.stringify(['x']))
      ;(window as unknown as { __cnmSyncDirty: (k: string) => void }).__cnmSyncDirty('cnmRemedy.shortfall.v1')
    })
    await page.waitForTimeout(2500)
    expect(attempts).toBe(1)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => attempts, { timeout: 5000 }).toBe(2)
  })
})
