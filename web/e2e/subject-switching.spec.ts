import { expect, test } from '@playwright/test'

test('home switches between subject data without a full reload', async ({ page }) => {
  await page.goto('/?subject=math')
  await expect(page.getByText('870').first()).toBeVisible()

  await page.locator('main').getByRole('button', { name: '英语' }).click()
  await expect(page).toHaveURL(/[?&]subject=english/)
  await expect(page.getByText('791').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /按年级/ })).toBeVisible()

  await page.locator('main').getByRole('button', { name: '物理' }).click()
  await expect(page).toHaveURL(/[?&]subject=physics/)
  await expect(page.getByText('269').first()).toBeVisible()

  await page.locator('main').getByRole('button', { name: '地理' }).click()
  await expect(page).toHaveURL(/[?&]subject=geography/)
  await expect(page.getByText('59').first()).toBeVisible()
})

test('explore switches between subject graph packages without a full reload', async ({ page }) => {
  await page.goto('/explore/?subject=math#cnm_221')
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()

  await page.locator('main').getByRole('button', { name: '英语' }).click()
  await expect(page).toHaveURL(/\/explore\/\?subject=english/)
  await expect(page.getByRole('heading', { name: '英语知识图谱' })).toBeVisible()
  await expect(page.locator('[data-testid="explore-topic-count"]')).toHaveText('791 个知识点')

  await page.locator('main').getByRole('button', { name: '物理' }).click()
  await expect(page).toHaveURL(/\/explore\/\?subject=physics/)
  await expect(page.getByRole('heading', { name: '物理知识图谱' })).toBeVisible()
  await expect(page.locator('[data-testid="explore-topic-count"]')).toHaveText('269 个知识点')
})


test('explore clears stale grade filter from another subject when switching', async ({ page }) => {
  await page.goto('/explore/?subject=math&grade=1')
  await expect(page.locator('[data-testid="explore-topic-count"]')).toHaveText('48 个知识点')

  await page.locator('main').getByRole('button', { name: '英语' }).click()
  await expect(page).toHaveURL(/\/explore\/\?subject=english/)
  await expect(page.locator('[data-testid="explore-topic-count"]')).toHaveText('791 个知识点')
})

test('diagnose clears stale keyword search when switching subject', async ({ page }) => {
  await page.goto('/diagnose/?subject=math')
  const search = page.getByPlaceholder('搜索知识点、章节或 ID')
  await search.fill('配方法')
  await expect(page.getByText('/ 870 个知识点')).toBeVisible()

  await page.locator('main').getByRole('button', { name: '英语', exact: true }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByText('120 / 791 个知识点')).toBeVisible()
})
