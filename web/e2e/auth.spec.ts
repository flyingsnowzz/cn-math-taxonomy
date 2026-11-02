import { expect, test, type Page } from '@playwright/test'

const pair = {
  accessToken: 'header.payload.sig',
  refreshToken: 'refresh-token-x',
  user: {
    id: '7',
    phone: '13800000000',
    nickname: null,
    entitlements: { member: false, expireAt: null, source: 'manual' },
  },
}

async function mockAuthApi(page: Page) {
  await page.route('**/auth/sms/request', async (route) => {
    await route.fulfill({ json: { ok: true, devCode: '123456' } })
  })
  await page.route('**/auth/sms/verify', async (route) => {
    await route.fulfill({ json: pair })
  })
  await page.route('**/auth/wechat/mp**', async (route) => {
    await route.fulfill({ json: pair })
  })
  await page.route('**/auth/logout', async (route) => {
    await route.fulfill({ json: { ok: true } })
  })
  await page.route('**/me', async (route) => {
    await route.fulfill({ json: pair.user })
  })
}

test.describe('账号层', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('cnmAuth.v1'))
  })

  test('未登录：顶栏有登录入口，公开诊断流程不被拦截', async ({ page }) => {
    await expect(page.locator('[data-test="nav-login"]')).toBeVisible()
    // 现有演示诊断在未登录时照常可用
    await page.goto('/diagnose/?target=cnm_221&demo=1')
    await expect(page.getByText(/诊断结果：配方法/)).toBeVisible({ timeout: 20_000 })
  })

  test('验证码登录：获取固定码 → 登录 → 顶栏显示脱敏手机号 → 刷新保持登录', async ({ page }) => {
    await mockAuthApi(page)
    await page.goto('/login?next=/account')
    await page.locator('[data-test="login-phone"]').fill('13800000000')
    await page.getByRole('button', { name: '获取验证码' }).click()
    await expect(page.locator('[data-test="login-info"]')).toContainText('验证码已发送')
    await page.locator('[data-test="login-code"]').fill('123456')
    await page.getByRole('button', { name: '登录 / 注册' }).click()

    await expect(page).toHaveURL(/\/account/)
    await expect(page.locator('[data-test="nav-account"]')).toContainText('138****0000')
    expect(await page.evaluate(() => localStorage.getItem('cnmAuth.v1'))).toContain('payload.sig')

    await page.reload()
    await expect(page.locator('[data-test="nav-account"]')).toContainText('138****0000')
  })

  test('后端错误显示在登录页，不跳转', async ({ page }) => {
    await page.route('**/auth/sms/verify', async (route) => {
      await route.fulfill({ status: 400, json: { error: { code: 'bad_code', message: '验证码不正确' } } })
    })
    await page.goto('/login')
    await page.locator('[data-test="login-phone"]').fill('13800000000')
    await page.locator('[data-test="login-code"]').fill('000000')
    await page.getByRole('button', { name: '登录 / 注册' }).click()
    await expect(page.locator('[data-test="login-error"]')).toContainText('验证码不正确')
    await expect(page).toHaveURL(/\/login/)
  })

  test('微信回调页用 code/state 自动登录', async ({ page }) => {
    await mockAuthApi(page)
    await page.goto('/login/callback/mp?code=mock-mp%3Aopenid-A%3Aunionid-U&state=signed-state')
    await expect(page.getByText('登录成功')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-test="nav-account"]')).toBeVisible()
  })

  test('微信回调缺参数显示失败并可返回登录', async ({ page }) => {
    await page.goto('/login/callback/open')
    await expect(page.locator('[data-test="wechat-error"]')).toContainText('缺少微信授权参数')
    await expect(page.getByRole('link', { name: '返回登录' })).toBeVisible()
  })
})
