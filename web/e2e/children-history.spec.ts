import { expect, test } from '@playwright/test'

test('history filters, record deletion and retest links work', async ({ page }) => {
  const backup = {
    format: 'cn-math-taxonomy.children',
    version: 1,
    exportedAt: '2026-11-01T00:00:00.000Z',
    profiles: {
      v: 1,
      current: 'child-history-1',
      children: [
        {
          id: 'child-history-1',
          name: '历史孩子',
          grade: '九年级',
          textbook: '人教版',
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    },
    records: {
      'child-history-1': [
        {
          key: 'math|history|cnm_221',
          subject: 'math',
          label: '配方法',
          mode: 'target',
          targets: ['cnm_221'],
          asked: 2,
          counts: { mastered: 0, shaky: 0, weak: 1, untested: 1 },
          weak: ['cnm_221'],
          shaky: [],
          mastered: [],
          roots: ['cnm_221'],
          savedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    },
  }

  await page.goto('/children/')
  await page.getByLabel('导入备份文件').setInputFiles({
    name: 'children-history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  })
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByRole('heading', { name: '历史孩子' })).toBeVisible()
  await page.evaluate(() => localStorage.setItem('selected-child', 'child-history-1'))

  await page.goto('/children/history/?child=child-history-1&subject=math')
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()
  await expect(page.getByRole('link', { name: '再测一次' })).toHaveAttribute(
    'href',
    '/diagnose/?subject=math&target=cnm_221',
  )

  await page.getByRole('button', { name: '删除记录' }).click()
  await expect(page.getByRole('heading', { name: '配方法' })).toHaveCount(0)
})
