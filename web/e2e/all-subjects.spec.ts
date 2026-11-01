import { expect, test } from '@playwright/test'

const subjects = [
  { code: 'math', label: '数学', topics: 870, questions: 3627 },
  { code: 'english', label: '英语', topics: 791, questions: 3164 },
  { code: 'physics', label: '物理', topics: 269, questions: 1076 },
  { code: 'chinese', label: '语文', topics: 493, questions: 1972 },
  { code: 'science', label: '科学', topics: 222, questions: 888 },
  { code: 'morality', label: '道德与法治', topics: 159, questions: 636 },
  { code: 'history', label: '历史', topics: 134, questions: 536 },
  { code: 'geography', label: '地理', topics: 59, questions: 236 },
] as const

for (const subject of subjects) {
  test(`home shows ${subject.label} content`, async ({ page }) => {
    await page.goto(`/?subject=${subject.code}`)
    await expect(page.locator('[data-testid="home-topic-count"]')).toHaveText(String(subject.topics))
    await expect(page.locator('[data-testid="home-question-count"]')).toHaveText(String(subject.questions))
  })

  test(`explore shows ${subject.label} content`, async ({ page }) => {
    await page.goto(`/explore/?subject=${subject.code}`)
    await expect(page.getByRole('heading', { name: `${subject.label}知识图谱` })).toBeVisible()
    await expect(page.locator('[data-testid="explore-topic-count"]')).toHaveText(`${subject.topics} 个知识点`)
  })
}
