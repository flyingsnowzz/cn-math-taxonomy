import { expect, test } from '@playwright/test'

test('English subject package loads independently for graph browsing', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/data/subjects/')) requests.push(url.pathname)
  })

  await page.goto('/explore/?subject=english#cne_p001')
  await expect(page.getByRole('heading', { name: '英语知识图谱' })).toBeVisible()
  await expect(page.getByText(/cne_p001/).first()).toBeVisible()
  expect(requests).toContain('/data/subjects/english.json')
  expect(requests.some((url) => url.includes('-questions.json'))).toBe(false)
})

test('English diagnosis loads the separate English question package', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/data/subjects/')) requests.push(url.pathname)
  })

  await page.goto('/diagnose/?subject=english&grade=%E5%9B%9B%E4%B8%8A&limit=1')
  await expect(page.getByText(/英语自适应诊断|上限 1/)).toBeVisible()
  await expect(page.getByRole('button', { name: '不会 / 跳过' })).toBeVisible()
  expect(requests).toContain('/data/subjects/english.json')
  expect(requests).toContain('/data/subjects/english-questions.json')
})
