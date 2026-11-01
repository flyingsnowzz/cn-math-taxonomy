import { expect, test } from '@playwright/test'

test('questions with SVG figures render stem and choice images', async ({ page }) => {
  await page.goto('/diagnose/?subject=math&target=cnm_050&limit=1')
  await expect(page.locator('.q-figure svg').first()).toBeVisible()
})
