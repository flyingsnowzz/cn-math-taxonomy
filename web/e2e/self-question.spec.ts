import { expect, test } from '@playwright/test'

test('self questions render a textarea and can be manually evaluated', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cnmDiagnose.seen.v1', JSON.stringify(['cnm_003_q2', 'cnm_003_q3', 'cnm_003_q4']))
  })
  await page.goto('/diagnose/?subject=math&target=cnm_003&seed=z0&confirm=1&limit=1')
  await expect(page.getByPlaceholder(/开放题/)).toBeVisible()
  await page.getByPlaceholder(/开放题/).fill('正数：3.5,7；0：0；负数：-2,-1/3')
  await page.getByRole('button', { name: '看参考答案并自评' }).click()
  await expect(page.getByText('系统无法可靠判定这道题，请对照参考答案手动确认。')).toBeVisible()
  await expect(page.getByText(/正数：3.5，7；0：0；负数：-2，-1\/3/)).toBeVisible()
  await page.getByRole('button', { name: '我答对了' }).click()
  await expect(page.getByText(/诊断结果/)).toBeVisible()
})
