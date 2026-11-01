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
  test(`${subject.label} diagnosis starts from subject question package`, async ({ page }) => {
    const scopeQuery = encodeURIComponent(subject.scope)
    await page.goto(`/diagnose/?subject=${subject.code}&grade=${scopeQuery}&limit=1`)
    await expect(page.getByRole('heading', { name: `${subject.label}自适应诊断` })).toBeVisible()
    await expect(page.getByRole('button', { name: '不会 / 跳过' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/第 1 题/)).toBeVisible()
  })
}
