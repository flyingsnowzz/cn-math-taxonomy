import { expect, test } from '@playwright/test'

test('screen diagnosis can extend question limit from result page', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&grade=%E4%B8%83%E4%B8%8A&limit=1')
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await expect(page.getByText('已达到题量上限（1）')).toBeVisible()
  await page.getByRole('button', { name: '再多答 10 题' }).click()
  await expect(page.getByText(/第 2 题 \/ 上限 11/)).toBeVisible()
})
