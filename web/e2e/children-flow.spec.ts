import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('child profile backup import keeps a profile available in the Vue app', async ({ page }) => {
  const backup = {
    format: 'cn-math-taxonomy.children',
    version: 1,
    exportedAt: '2026-11-01T00:00:00.000Z',
    profiles: {
      v: 1,
      current: 'child-e2e-1',
      children: [
        {
          id: 'child-e2e-1',
          name: 'E2E孩子',
          grade: '七年级',
          textbook: '人教版',
          createdAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    },
    records: {
      'child-e2e-1': [
        {
          key: 'math|e2e|cnm_221',
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
    name: 'children-e2e.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  })

  await expect(page.getByText('导入预览')).toBeVisible()
  await expect(page.getByText('新增孩子：1')).toBeVisible()
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByRole('heading', { name: 'E2E孩子' })).toBeVisible()
  await expect(page.getByText('1 条本地诊断记录')).toBeVisible()

  await page.goto('/children/history/')
  await page.getByRole('heading', { name: /诊断历史/ }).waitFor()
  await expect(page.getByRole('heading', { name: '配方法' })).toBeVisible()
  await expect(page.getByText('薄弱 1', { exact: true })).toBeVisible()
})
