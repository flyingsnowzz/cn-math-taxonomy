import { expect, test } from '@playwright/test'

test('short algebraic questions accept text and use reference-answer fallback', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cnmDiagnose.seen.v1', JSON.stringify(['cnm_025_q2', 'cnm_025_q3', 'cnm_025_q4']))
  })
  await page.goto('/diagnose/?subject=math&target=cnm_025&seed=short&confirm=1&limit=1')
  await expect(page.getByText(/用字母表示加法交换律/)).toBeVisible()
  await page.getByLabel('输入答案').fill('a+b=b+a')
  await page.getByRole('button', { name: '提交' }).click()
  await expect(page.getByText('自动判定：正确')).toBeVisible()
})
