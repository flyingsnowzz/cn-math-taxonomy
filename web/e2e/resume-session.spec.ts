import { expect, test } from '@playwright/test'

test('saved diagnosis can be resumed or discarded from the start page', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&target=cnm_221&limit=1')
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await expect(page.getByText(/诊断结果：配方法/)).toBeVisible()

  await page.goto('/diagnose/?subject=math')
  await expect(page.getByRole('heading', { name: '继续上次诊断' })).toBeVisible()
  await page.getByRole('button', { name: '继续' }).click()
  await expect(page.getByText(/诊断结果：配方法/)).toBeVisible()

  await page.goto('/diagnose/?subject=math')
  await page.getByRole('button', { name: '放弃存档' }).click()
  await expect(page.getByRole('heading', { name: '继续上次诊断' })).toHaveCount(0)
})
