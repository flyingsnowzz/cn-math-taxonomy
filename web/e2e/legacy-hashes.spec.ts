import { expect, test } from '@playwright/test'

const LEGACY_HASH_TOPICS = [
  { subject: 'math', id: 'cnm_221', name: '配方法' },
  { subject: 'english', id: 'cne_p001', name: '英语字母表' },
  { subject: 'physics', id: 'cnp_001', name: '长度和时间的测量' },
  { subject: 'chinese', id: 'cnc_p001', name: '识字：天地人' },
  { subject: 'science', id: 'cns_p001', name: '我们知道的植物' },
  { subject: 'morality', id: 'cnd_p001', name: '开开心心上学去' },
  { subject: 'history', id: 'cnh_j001', name: '远古时期的人类活动' },
  { subject: 'geography', id: 'cng_j001', name: '地球的宇宙环境' },
] as const

for (const topic of LEGACY_HASH_TOPICS) {
  test(`legacy hash for ${topic.subject} opens the graph topic`, async ({ page }) => {
    await page.goto(`/#${topic.id}`)
    await expect(page).toHaveURL(new RegExp(`/explore/\\?subject=${topic.subject}#${topic.id}`))
    await expect(page.getByRole('heading', { name: topic.name, exact: true })).toBeVisible()
  })
}
