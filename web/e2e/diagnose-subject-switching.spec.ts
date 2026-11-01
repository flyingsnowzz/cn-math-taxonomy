import { expect, test } from '@playwright/test'

test('diagnosis page switches subject package and starts a fresh target selection', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&grade=%E4%B8%83%E4%B8%8A&limit=1')
  await expect(page.getByRole('heading', { name: '数学自适应诊断' })).toBeVisible()
  await expect(page.getByRole('button', { name: '不会 / 跳过' })).toBeVisible()

  await page.locator('main').getByRole('button', { name: '英语' }).click()
  await expect(page).toHaveURL(/\/diagnose\/\?subject=english/)
  await expect(page.getByRole('heading', { name: '英语自适应诊断' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索知识点、章节或 ID')).toBeVisible()

  await page.locator('main').getByRole('button', { name: '物理' }).click()
  await expect(page).toHaveURL(/\/diagnose\/\?subject=physics/)
  await expect(page.getByRole('heading', { name: '物理自适应诊断' })).toBeVisible()
  await expect(page.getByPlaceholder('搜索知识点、章节或 ID')).toBeVisible()
})
