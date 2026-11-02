import { expect, test } from '@playwright/test'

const subjects = [
  { code: 'math', label: '数学', scope: '七上' },
  { code: 'english', label: '英语', scope: '四上' },
  { code: 'physics', label: '物理', scope: '八上' },
  { code: 'chinese', label: '语文', scope: '一上' },
  { code: 'science', label: '科学', scope: '三上' },
  { code: 'morality', label: '道德与法治', scope: '一上' },
  { code: 'history', label: '历史', scope: '七上' },
  { code: 'geography', label: '地理', scope: '七上' },
] as const

for (const subject of subjects) {
  test(`${subject.label}整册筛查在一题后生成章节汇总`, async ({ page }) => {
    await page.goto(`/diagnose/?subject=${subject.code}&grade=${encodeURIComponent(subject.scope)}&limit=1`)
    await expect(page.getByText('整体诊断')).toBeVisible()
    await page.getByRole('button', { name: '不会 / 跳过' }).click()
    await page.getByRole('button', { name: '下一题' }).click()
    await expect(page.getByRole('heading', { name: '按章汇总' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/范围内共/)).toBeVisible()
  })
}
