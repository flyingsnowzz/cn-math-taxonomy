import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const FEATURES = ['unlimited_practice', 'ai_explain', 'report_detail', 'multi_child', 'review_reminders']

function user(member: boolean) {
  return {
    id: '7', phone: '13800000000', nickname: null,
    entitlements: { member, expireAt: null, source: 'manual' },
  }
}

async function setup(page: Page, member: boolean) {
  const current = { member }
  await page.addInitScript((initialMember) => {
    localStorage.setItem('cnmAuth.v1', JSON.stringify({
      v: 1, accessToken: 'access-1', refreshToken: 'refresh-1',
      user: {
        id: '7', phone: '13800000000', nickname: null,
        entitlements: { member: initialMember, expireAt: null, source: 'manual' },
      },
    }))
  }, member)
  await page.route((url) => url.pathname === '/sync', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/track', (route) => route.fulfill({ json: { accepted: 0 } }))
  await page.route('**/me', async (route) => {
    await route.fulfill({ json: user(current.member) })
  })
  return current
}

test.describe('会员权益骨架', () => {
  test('免费账号每个功能入口均显示统一弹层并记录 paywall_view，无交易按钮', async ({ page }) => {
    await setup(page, false)
    await page.goto('/account')
    await expect(page.locator('[data-test="member-status"]')).toHaveText('免费版（会员功能即将开放）')
    for (const feature of FEATURES) {
      await page.locator(`[data-test="feature-${feature}"]`).click()
      await expect(page.getByRole('dialog')).toContainText('会员功能，即将开放')
      await expect(page.locator('[data-test="member-feature-content"]')).toHaveCount(0)
      await page.locator('[data-test="paywall-close"]').click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
    const names = await page.evaluate(() =>
      (JSON.parse(localStorage.getItem('cnmTrack.v1') ?? '[]') as Array<{ name: string }>).map((event) => event.name))
    expect(names.filter((name) => name === 'paywall_view')).toHaveLength(FEATURES.length)
    await expect(page.getByRole('button', { name: /立即购买|去付款|开通会员|下单/ })).toHaveCount(0)
  })

  test('会员账号可查看每个会员内容，免费弹层不出现', async ({ page }) => {
    await setup(page, true)
    await page.goto('/account')
    await expect(page.locator('[data-test="member-status"]')).toHaveText('会员')
    for (const feature of FEATURES) {
      await page.locator(`[data-test="feature-${feature}"]`).click()
      await expect(page.locator('[data-test="member-feature-content"]')).toContainText('会员内容已解锁')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })

  test('手工开通后重新拉 /me 解锁', async ({ page }) => {
    const current = await setup(page, false)
    await page.goto('/account')
    await page.locator('[data-test="feature-report_detail"]').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.locator('[data-test="paywall-close"]').click()

    current.member = true
    await page.locator('[data-test="refresh-entitlements"]').click()
    await expect(page.locator('[data-test="member-status"]')).toHaveText('会员')
    await page.locator('[data-test="feature-report_detail"]').click()
    await expect(page.locator('[data-test="member-feature-content"]')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
