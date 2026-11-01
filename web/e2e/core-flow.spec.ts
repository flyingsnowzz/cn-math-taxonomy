import { expect, test } from '@playwright/test'

test('home loads subject statistics and navigates to the graph', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '先找到真正没有学会的那一步' })).toBeVisible()
  await expect(page.getByText('知识点').first()).toBeVisible()
  await page.getByRole('link', { name: '浏览知识图谱' }).click()
  await expect(page).toHaveURL(/\/explore\/\?subject=math/)
  await expect(page.getByRole('heading', { name: '数学知识图谱' })).toBeVisible()
})

test('legacy topic hash redirects to the matching subject graph', async ({ page }) => {
  await page.goto('/#cnm_221')
  await expect(page).toHaveURL(/\/explore\/\?subject=math#cnm_221/)
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()
})

test('diagnosis demo shows result, learning path and share action', async ({ page }) => {
  await page.goto('/diagnose/?target=cnm_221&demo=1')
  await expect(page.getByText(/诊断结果：配方法/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: '薄弱根因' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '建议学习路径' })).toBeVisible()
  await expect(page.getByRole('button', { name: '生成分享图' })).toBeVisible()
})

test('chapter URL starts a whole-chapter target session', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&chapter=七上%20第一章')
  await expect(page.getByText('整章')).toBeVisible()
  await expect(page.getByText(/第 1 题/)).toBeVisible()
})

test('production service worker supports offline reload', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.state === 'activated'
  })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await page.reload()
  await expect(page.getByRole('heading', { name: '先找到真正没有学会的那一步' })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: '先找到真正没有学会的那一步' })).toBeVisible()
  await context.setOffline(false)
})

test('knowledge graph remains usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/explore/?subject=math#cnm_221')
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()
  await expect(page.getByRole('button', { name: '适配画面' })).toBeVisible()
  await expect(page.getByRole('link', { name: '诊断这个知识点' })).toBeVisible()
})

test('single-volume screen diagnosis exposes chapter summary metadata', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&grade=%E4%B8%83%E4%B8%8A&limit=2')
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await expect(page.getByRole('heading', { name: '章节筛查汇总' })).toBeVisible()
})

test('legacy file routes redirect to Vue routes', async ({ page }) => {
  await page.goto('/diagnose/index.html?target=cnm_221&demo=1')
  await expect(page).toHaveURL(/\/diagnose\/\?.*target=cnm_221.*demo=1.*subject=math|\/diagnose\/\?subject=math&target=cnm_221&demo=1/)
  await expect(page.getByText(/诊断结果：配方法/)).toBeVisible()

  await page.goto('/explore/index.html#cnm_221')
  await expect(page).toHaveURL(/\/explore\/[?#]/)
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()
})

test('explore filters and depth are reflected in shareable URL', async ({ page }) => {
  await page.goto('/explore/?subject=math&grade=9&domain=%E6%95%B0%E4%B8%8E%E4%BB%A3%E6%95%B0&depth=1#cnm_221')
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()
  await expect(page).toHaveURL(/grade=9/)
  await expect(page).toHaveURL(/domain=.*%E6%95%B0/)
  await expect(page).toHaveURL(/depth=1/)
})
