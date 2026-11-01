import { expect, test } from '@playwright/test'

test('history page reacts to child and subject query changes without reload', async ({ page }) => {
  const backup = {
    format: 'cn-math-taxonomy.children',
    version: 1,
    exportedAt: '2026-11-01T00:00:00.000Z',
    profiles: {
      v: 1,
      current: 'child-a',
      children: [
        { id: 'child-a', name: '孩子甲', grade: '七年级', textbook: '人教版', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 'child-b', name: '孩子乙', grade: '八年级', textbook: '人教版', createdAt: '2026-11-01T00:00:00.000Z' },
      ],
    },
    records: {
      'child-a': [
        {
          key: 'math|a', subject: 'math', label: '数学记录', mode: 'target', targets: ['cnm_221'],
          asked: 1, counts: { weak: 1 }, weak: ['cnm_221'], shaky: [], mastered: [], roots: ['cnm_221'], savedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      'child-b': [
        {
          key: 'english|b', subject: 'english', label: '英语记录', mode: 'target', targets: ['cne_p001'],
          asked: 1, counts: { weak: 1 }, weak: ['cne_p001'], shaky: [], mastered: [], roots: ['cne_p001'], savedAt: '2026-11-02T00:00:00.000Z',
        },
      ],
    },
  }

  await page.goto('/children/')
  await page.getByLabel('导入备份文件').setInputFiles({
    name: 'children.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  })
  await page.getByRole('button', { name: '确认合并导入' }).click()

  await page.goto('/children/history/?child=child-a&subject=math')
  await expect(page.getByRole('heading', { name: '数学记录' })).toBeVisible()

  await page.goto('/children/history/?child=child-b&subject=english')
  await expect(page.getByRole('heading', { name: '英语记录' })).toBeVisible()
})
