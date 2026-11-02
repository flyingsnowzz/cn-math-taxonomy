import { readFileSync } from 'node:fs'
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
  await expect(page.getByRole('heading', { name: '按章汇总' })).toBeVisible()
  await expect(page.getByRole('link', { name: '再测本章薄弱' }).first()).toBeVisible()
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


test('target diagnosis result names prerequisite topics left untested by the limit', async ({ page }) => {
  await page.goto('/diagnose/?target=cnm_221&limit=2')
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()

  await expect(page.getByText(/它的先修「.*没来得及测（题量用完）/)).toBeVisible()
})


test('legacy external alias id finds its formal target topics in graph search', async ({ page }) => {
  await page.goto('/explore/?subject=math&q=cnm_ext_002')
  await expect(page.locator('[data-testid="explore-topic-count"]')).toHaveText('4 个知识点')
})


test('diagnosis result exposes standards and editable answer log', async ({ page }) => {
  await page.goto('/diagnose/?target=cnm_221&limit=2')
  for (let index = 0; index < 2; index += 1) {
    await page.getByRole('button', { name: '不会 / 跳过' }).click()
    await page.getByRole('button', { name: '下一题' }).click()
  }

  await expect(page.getByRole('heading', { name: '关联课标条目' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '答题记录（可更正）' })).toBeVisible()
  await expect(page.locator('tbody select').first().locator('option')).toHaveCount(3)
  await page.locator('tbody select').first().selectOption('correct')
  await expect(page.locator('tbody select').first()).toHaveValue('correct')
})


test('PWA install prompt appears and accepts a browser installation event', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { bubbles: true, cancelable: true })
    Object.assign(event, {
      preventDefault() {},
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(event)
  })

  await expect(page.getByRole('region', { name: '添加到桌面' })).toBeVisible()
  await page.getByRole('button', { name: '添加' }).click()
  await expect(page.getByRole('region', { name: '添加到桌面' })).toHaveCount(0)
})


test('diagnosis JSON export preserves v2 result details', async ({ page }) => {
  await page.goto('/diagnose/?target=cnm_221&limit=2')
  for (let index = 0; index < 2; index += 1) {
    await page.getByRole('button', { name: '不会 / 跳过' }).click()
    await page.getByRole('button', { name: '下一题' }).click()
  }

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 JSON' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()
  const payload = JSON.parse(readFileSync(path!, 'utf8'))

  expect(payload.version).toBe(2)
  expect(payload.tool).toBe('cn-math-taxonomy/diagnose')
  expect(payload.answers).toHaveLength(2)
  expect(payload.weakRoots[0].pendingPrereqs.length).toBeGreaterThan(0)
  expect(Array.isArray(payload.standards)).toBeTruthy()
})

test('explore restores the saved prerequisite depth from session storage', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('cnmExplore.depth', '3'))
  await page.goto('/explore/?subject=math#cnm_221')
  await expect(page.getByRole('button', { name: '向上 3' })).toHaveClass(/bg-teal-700/)
  await expect(page).toHaveURL(/depth=3/)
})

test('whole-grade diagnosis includes both semesters for primary scope', async ({ page }) => {
  await page.goto('/diagnose/?subject=english&grade=%E4%B8%89%E5%B9%B4%E7%BA%A7&limit=1')
  await expect(page.getByText('整体诊断')).toBeVisible()
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await expect(page.getByText(/范围内共 71 个知识点/)).toBeVisible()
})

test('whole-grade math diagnosis includes upper and lower semester topics', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&grade=%E4%B8%83%E5%B9%B4%E7%BA%A7&limit=1')
  await page.getByRole('button', { name: '不会 / 跳过' }).click()
  await page.getByRole('button', { name: '下一题' }).click()
  await expect(page.getByText(/范围内共 119 个知识点/)).toBeVisible()
})

test('explore all-ancestor graph can fold and expand by grade', async ({ page }) => {
  await page.goto('/explore/?subject=math&depth=99#cnm_p111')
  await expect(page.getByText('祖先较多，已按年级收起')).toBeVisible()
  await expect(page.getByRole('button', { name: '共 50 个，点此展开全部' })).toBeVisible()
  await page.getByRole('button', { name: '共 50 个，点此展开全部' }).click()
  await expect(page.getByText('按年级收起')).toBeVisible()
})
