import { expect, test } from '@playwright/test'

test('diagnostic settings control target and screen session limits', async ({ page }) => {
  await page.goto('/diagnose/?subject=math')
  await expect(page.getByRole('heading', { name: '诊断设置' })).toBeVisible()

  await page.getByLabel('单点/整章题量上限').fill('12')
  await page.getByPlaceholder('搜索知识点、章节或 ID').fill('配方法')
  await page.getByRole('button', { name: /配方法/ }).first().click()
  await expect(page.getByText(/上限 12/)).toBeVisible()

  await page.goto('/diagnose/?subject=math')
  await page.getByLabel('整体筛查题量上限').fill('22')
  await page.getByRole('button', { name: '七上' }).click()
  await expect(page.getByText(/上限 22/)).toBeVisible()
})
